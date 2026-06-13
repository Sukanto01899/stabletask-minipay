// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Deploy steps:
//  1. Deploy this contract with (cusdAddress, xpTokenAddress)
//     - cusd:    0x765DE816845861e75A25fCA122bb6898B8B1282a (Celo mainnet cUSD)
//     - xpToken: address of StableTaskRewardVault (which IS the XP ERC-20)
//  2. On StableTaskRewardVault call:
//       grantMinter(address(this_contract))
//     (you must add that function to the vault — see comment below)
//  3. Set NEXT_PUBLIC_YIELD_VAULT_ADDRESS in .env to this contract address.
//
// NOTE: StableTaskRewardVault needs a minter role function added:
//   mapping(address => bool) public minters;
//   function grantMinter(address m) external onlyOwner { minters[m] = true; }
//   function mint(address to, uint256 amount) external { require(minters[msg.sender]); _mint(to, amount); }

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IXPMintable {
    function mint(address to, uint256 amount) external;
}

contract StableTaskYieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20  public immutable cusd;
    IXPMintable public immutable xpToken;

    // 1 XP per 1 cUSD per day.
    // Both cUSD and XP use 18 decimals.
    // accrued = amount_wei * elapsed_seconds / 86400
    uint256 public constant SECONDS_PER_DAY = 86400;

    struct Position {
        uint256 amount;     // cUSD deposited (18 dec)
        uint256 checkpoint; // timestamp of last deposit / withdraw / claim
        uint256 pendingXp;  // XP accrued but not yet claimed (18 dec)
    }

    mapping(address => Position) public positions;

    event Deposited(address indexed user, uint256 amount, uint256 newTotal);
    event Withdrawn(address indexed user, uint256 amount, uint256 remaining);
    event XPClaimed(address indexed user, uint256 xpAmount);

    constructor(address _cusd, address _xpToken) Ownable(msg.sender) {
        cusd    = IERC20(_cusd);
        xpToken = IXPMintable(_xpToken);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /// @notice XP the user has earned but not yet claimed.
    function pendingXP(address user) public view returns (uint256) {
        Position storage p = positions[user];
        uint256 accrued = p.amount > 0
            ? (p.amount * (block.timestamp - p.checkpoint)) / SECONDS_PER_DAY
            : 0;
        return p.pendingXp + accrued;
    }

    /// @notice cUSD currently deposited by a user.
    function depositOf(address user) external view returns (uint256) {
        return positions[user].amount;
    }

    // ── Actions ────────────────────────────────────────────────────────────

    /// @notice Deposit cUSD. Must approve this contract first.
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        _checkpoint(msg.sender);
        cusd.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].amount += amount;
        emit Deposited(msg.sender, amount, positions[msg.sender].amount);
    }

    /// @notice Withdraw any amount of cUSD at any time.
    function withdraw(uint256 amount) external nonReentrant {
        Position storage p = positions[msg.sender];
        require(p.amount >= amount, "Insufficient deposit");
        _checkpoint(msg.sender);
        p.amount -= amount;
        cusd.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, p.amount);
    }

    /// @notice Claim all accrued XP. Mints XP tokens to the caller.
    function claimXP() external nonReentrant {
        _checkpoint(msg.sender);
        uint256 xp = positions[msg.sender].pendingXp;
        require(xp > 0, "No XP to claim");
        positions[msg.sender].pendingXp = 0;
        xpToken.mint(msg.sender, xp);
        emit XPClaimed(msg.sender, xp);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    /// Snapshot accrued XP into pendingXp and reset the clock.
    function _checkpoint(address user) internal {
        Position storage p = positions[user];
        if (p.amount > 0) {
            p.pendingXp += (p.amount * (block.timestamp - p.checkpoint)) / SECONDS_PER_DAY;
        }
        p.checkpoint = block.timestamp;
    }
}
