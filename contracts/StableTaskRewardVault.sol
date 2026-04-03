// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract StableTaskRewardVault is ERC20, Ownable, Pausable {
    using SafeERC20 for IERC20;

    enum TaskType {
        Visit,
        DailyClaim,
        Reading
    }

    struct Task {
        uint256 id;
        TaskType taskType;
        address creator;
        uint256 pointReward;
        uint256 rewardAmount;
        bool active;
        bool publicCreated;
        string metadataURI;
    }

    IERC20 public immutable rewardToken;
    uint256 public nextTaskId;
    uint256 public publicTaskCreationFee;

    mapping(uint256 taskId => Task task) public tasks;
    mapping(uint256 taskId => mapping(address user => bool completed)) public isCompleted;
    mapping(uint256 taskId => mapping(address user => bool claimed)) public hasClaimedReward;
    mapping(uint256 taskId => mapping(address user => bool claimed)) public hasClaimedPoint;

    event TaskCreated(
        uint256 indexed taskId,
        TaskType indexed taskType,
        address indexed creator,
        uint256 pointReward,
        uint256 rewardAmount,
        bool publicCreated,
        string metadataURI
    );
    event TaskCompleted(uint256 indexed taskId, address indexed user, address indexed operator);
    event PointClaimed(uint256 indexed taskId, address indexed user, uint256 amount);
    event RewardClaimed(
        uint256 indexed taskId,
        address indexed user,
        address indexed rewardToken,
        uint256 rewardAmount
    );
    event PublicTaskCreationFeeUpdated(uint256 newFee);
    event VaultFunded(address indexed funder, uint256 amount);
    event NativeFeesWithdrawn(address indexed recipient, uint256 amount);

    error DuplicateClaim(uint256 taskId, address user);
    error InvalidTask(uint256 taskId);
    error InvalidTaskType();
    error TaskInactive(uint256 taskId);
    error TaskNotCompleted(uint256 taskId, address user);
    error ZeroAddress();
    error ZeroAmount();
    error IncorrectFee(uint256 expected, uint256 actual);

    constructor(
        address rewardTokenAddress,
        string memory pointName,
        string memory pointSymbol,
        uint256 initialPublicTaskCreationFee,
        address initialOwner
    ) ERC20(pointName, pointSymbol) Ownable(initialOwner) {
        if (rewardTokenAddress == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }

        rewardToken = IERC20(rewardTokenAddress);
        publicTaskCreationFee = initialPublicTaskCreationFee;
    }

    function createTask(
        TaskType taskType,
        uint256 pointReward,
        uint256 rewardAmount,
        string calldata metadataURI
    ) external onlyOwner whenNotPaused returns (uint256 taskId) {
        taskId = _createTask(taskType, msg.sender, pointReward, rewardAmount, metadataURI, false);
    }

    function createPublicTask(
        TaskType taskType,
        uint256 pointReward,
        uint256 rewardAmount,
        string calldata metadataURI
    ) external payable whenNotPaused returns (uint256 taskId) {
        if (taskType != TaskType.Visit && taskType != TaskType.Reading) {
            revert InvalidTaskType();
        }
        if (msg.value != publicTaskCreationFee) {
            revert IncorrectFee(publicTaskCreationFee, msg.value);
        }

        taskId = _createTask(taskType, msg.sender, pointReward, rewardAmount, metadataURI, true);
    }

    function markTaskCompleted(uint256 taskId, address user) external onlyOwner whenNotPaused {
        if (user == address(0)) {
            revert ZeroAddress();
        }

        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }

        isCompleted[taskId][user] = true;
        emit TaskCompleted(taskId, user, msg.sender);
    }

    function claimTaskPoint(uint256 taskId) external whenNotPaused {
        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }
        if (!isCompleted[taskId][msg.sender]) {
            revert TaskNotCompleted(taskId, msg.sender);
        }
        if (hasClaimedPoint[taskId][msg.sender]) {
            revert DuplicateClaim(taskId, msg.sender);
        }
        if (task.pointReward == 0) {
            revert ZeroAmount();
        }

        hasClaimedPoint[taskId][msg.sender] = true;
        _mint(msg.sender, task.pointReward);

        emit PointClaimed(taskId, msg.sender, task.pointReward);
    }

    function claimReward(uint256 taskId, address user) external onlyOwner whenNotPaused {
        if (user == address(0)) {
            revert ZeroAddress();
        }

        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }
        if (!isCompleted[taskId][user]) {
            revert TaskNotCompleted(taskId, user);
        }
        if (hasClaimedReward[taskId][user]) {
            revert DuplicateClaim(taskId, user);
        }
        if (task.rewardAmount == 0) {
            revert ZeroAmount();
        }

        hasClaimedReward[taskId][user] = true;
        rewardToken.safeTransfer(user, task.rewardAmount);

        emit RewardClaimed(taskId, user, address(rewardToken), task.rewardAmount);
    }

    function setTaskActive(uint256 taskId, bool active) external onlyOwner {
        Task storage task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }

        task.active = active;
    }

    function setPublicTaskCreationFee(uint256 newFee) external onlyOwner {
        publicTaskCreationFee = newFee;
        emit PublicTaskCreationFeeUpdated(newFee);
    }

    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) {
            revert ZeroAmount();
        }

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    function withdrawNativeFees(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (amount > address(this).balance) {
            revert ZeroAmount();
        }

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Native fee withdrawal failed");

        emit NativeFeesWithdrawn(recipient, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _createTask(
        TaskType taskType,
        address creator,
        uint256 pointReward,
        uint256 rewardAmount,
        string calldata metadataURI,
        bool publicCreated
    ) internal returns (uint256 taskId) {
        if (creator == address(0)) {
            revert ZeroAddress();
        }
        if (pointReward == 0) {
            revert ZeroAmount();
        }

        taskId = nextTaskId;
        nextTaskId += 1;

        tasks[taskId] = Task({
            id: taskId,
            taskType: taskType,
            creator: creator,
            pointReward: pointReward,
            rewardAmount: rewardAmount,
            active: true,
            publicCreated: publicCreated,
            metadataURI: metadataURI
        });

        emit TaskCreated(
            taskId,
            taskType,
            creator,
            pointReward,
            rewardAmount,
            publicCreated,
            metadataURI
        );
    }
}
