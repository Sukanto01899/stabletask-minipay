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
    uint256 public constant TAP_XP_REWARD = 1 ether;
    uint256 public constant DAILY_TAP_LIMIT = 1000;
    uint256 public nextTaskId;
    uint256 public publicTaskCreationFee;
    uint256 public dailyTaskId;
    bool public hasDailyTask;

    mapping(uint256 => Task) public tasks;
    mapping(address => mapping(uint256 => uint256)) public dailyTapCount;
    mapping(uint256 => mapping(address => bool)) public isCompleted;
    mapping(uint256 => mapping(address => bool)) public hasClaimedReward;
    mapping(uint256 => mapping(address => bool)) public hasClaimedPoint;
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public dailyCheckIns;
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public dailyPointClaimed;
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public dailyRewardClaimed;

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
    event DailyCheckIn(uint256 indexed taskId, address indexed user, uint256 indexed day);
    event TapRecorded(address indexed user, uint256 indexed day, uint256 tapCount, uint256 xpAmount);

    error DuplicateClaim(uint256 taskId, address user);
    error DailyTaskAlreadyExists(uint256 taskId);
    error InvalidTask(uint256 taskId);
    error InvalidTaskType();
    error TaskInactive(uint256 taskId);
    error TaskNotCompleted(uint256 taskId, address user);
    error ZeroAddress();
    error ZeroAmount();
    error IncorrectFee(uint256 expected, uint256 actual);
    error DailyTapLimitReached(address user, uint256 day);

    function currentDay() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

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

    function selfCompleteTask(uint256 taskId) external whenNotPaused {
        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }
        if (task.taskType == TaskType.DailyClaim) {
            revert InvalidTaskType();
        }
        if (isCompleted[taskId][msg.sender]) {
            revert DuplicateClaim(taskId, msg.sender);
        }

        isCompleted[taskId][msg.sender] = true;
        emit TaskCompleted(taskId, msg.sender, msg.sender);
    }

    function checkInDailyTask(uint256 taskId) external whenNotPaused {
        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (task.taskType != TaskType.DailyClaim) {
            revert InvalidTaskType();
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }

        uint256 day = currentDay();
        if (dailyCheckIns[taskId][msg.sender][day]) {
            revert DuplicateClaim(taskId, msg.sender);
        }

        dailyCheckIns[taskId][msg.sender][day] = true;
        emit DailyCheckIn(taskId, msg.sender, day);
    }

    function tap() external whenNotPaused returns (uint256 tapCount) {
        uint256 day = currentDay();
        tapCount = dailyTapCount[msg.sender][day];
        if (tapCount >= DAILY_TAP_LIMIT) {
            revert DailyTapLimitReached(msg.sender, day);
        }

        tapCount += 1;
        dailyTapCount[msg.sender][day] = tapCount;
        _mint(msg.sender, TAP_XP_REWARD);

        emit TapRecorded(msg.sender, day, tapCount, TAP_XP_REWARD);
    }

    function tapsToday(address user) public view returns (uint256) {
        if (user == address(0)) {
            return 0;
        }

        return dailyTapCount[user][currentDay()];
    }

    function remainingTaps(address user) external view returns (uint256) {
        uint256 used = tapsToday(user);
        if (used >= DAILY_TAP_LIMIT) {
            return 0;
        }

        return DAILY_TAP_LIMIT - used;
    }

    function claimTaskPoint(uint256 taskId) external whenNotPaused {
        Task memory task = tasks[taskId];
        if (task.creator == address(0)) {
            revert InvalidTask(taskId);
        }
        if (!task.active) {
            revert TaskInactive(taskId);
        }
        if (task.taskType == TaskType.DailyClaim) {
            uint256 day = currentDay();
            if (!dailyCheckIns[taskId][msg.sender][day]) {
                revert TaskNotCompleted(taskId, msg.sender);
            }
            if (dailyPointClaimed[taskId][msg.sender][day]) {
                revert DuplicateClaim(taskId, msg.sender);
            }
            if (task.pointReward == 0) {
                revert ZeroAmount();
            }

            dailyPointClaimed[taskId][msg.sender][day] = true;
            _mint(msg.sender, task.pointReward);

            emit PointClaimed(taskId, msg.sender, task.pointReward);
            return;
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
        if (task.taskType == TaskType.DailyClaim) {
            uint256 day = currentDay();
            if (!dailyCheckIns[taskId][user][day]) {
                revert TaskNotCompleted(taskId, user);
            }
            if (dailyRewardClaimed[taskId][user][day]) {
                revert DuplicateClaim(taskId, user);
            }
            if (task.rewardAmount == 0) {
                revert ZeroAmount();
            }

            dailyRewardClaimed[taskId][user][day] = true;
            rewardToken.safeTransfer(user, task.rewardAmount);

            emit RewardClaimed(taskId, user, address(rewardToken), task.rewardAmount);
            return;
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
        if (taskType == TaskType.DailyClaim && hasDailyTask) {
            revert DailyTaskAlreadyExists(dailyTaskId);
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

        if (taskType == TaskType.DailyClaim) {
            hasDailyTask = true;
            dailyTaskId = taskId;
        }

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
