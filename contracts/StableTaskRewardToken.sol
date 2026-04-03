// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StableTaskRewardToken is ERC20, Ownable {
    uint8 private immutable _customDecimals;

    event TokensMinted(address indexed operator, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (initialOwner == address(0)) {
            revert ZeroAddress();
        }

        _customDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        _mint(to, amount);
        emit TokensMinted(msg.sender, to, amount);
    }
}
