// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title YEET Swarm MVP Registry
/// @notice Initial economic logic prototype for task registry, node staking, rewards, and slashing.
/// @dev The Solana Frontier target is a Rust + Anchor program; this Solidity contract is retained as a prototype sketch.
contract YeetSwarm {
    enum RolePreference {
        Executor,
        Validator,
        Challenger,
        Hybrid
    }

    enum TaskState {
        Open,
        Assigned,
        Resolved,
        Cancelled
    }

    struct Node {
        address operator;
        string hardwareProfile;
        uint256 gpuScore;
        uint256 vramGb;
        uint256 ramGb;
        uint256 reliabilityScore;
        uint256 stake;
        uint256 rewardsEarned;
        uint256 fraudHistory;
        RolePreference rolePreference;
        bool active;
    }

    struct Task {
        address requester;
        string name;
        string taskType;
        uint256 rewardPool;
        uint256 redundancyFactor;
        uint256 difficulty;
        uint256 verificationThreshold;
        uint256 executionTimeout;
        bytes32 verifiedDigest;
        TaskState state;
    }

    uint256 public nextNodeId = 1;
    uint256 public nextTaskId = 1;
    address public orchestrator;

    mapping(uint256 => Node) public nodes;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256) public operatorNodeId;

    event NodeRegistered(uint256 indexed nodeId, address indexed operator, RolePreference rolePreference, uint256 stake);
    event StakeAdded(uint256 indexed nodeId, uint256 amount);
    event TaskYeeted(uint256 indexed taskId, address indexed requester, string taskType, uint256 rewardPool);
    event TaskResolved(uint256 indexed taskId, bytes32 verifiedDigest);
    event RewardPaid(uint256 indexed taskId, uint256 indexed nodeId, uint256 amount, string reason);
    event NodeSlashed(uint256 indexed taskId, uint256 indexed nodeId, uint256 amount, string reason);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "not orchestrator");
        _;
    }

    constructor() {
        orchestrator = msg.sender;
    }

    function registerNode(
        string calldata hardwareProfile,
        uint256 gpuScore,
        uint256 vramGb,
        uint256 ramGb,
        uint256 reliabilityScore,
        RolePreference rolePreference
    ) external payable returns (uint256 nodeId) {
        require(msg.value > 0, "stake required");
        require(operatorNodeId[msg.sender] == 0, "operator already registered");

        nodeId = nextNodeId++;
        nodes[nodeId] = Node({
            operator: msg.sender,
            hardwareProfile: hardwareProfile,
            gpuScore: gpuScore,
            vramGb: vramGb,
            ramGb: ramGb,
            reliabilityScore: reliabilityScore,
            stake: msg.value,
            rewardsEarned: 0,
            fraudHistory: 0,
            rolePreference: rolePreference,
            active: true
        });
        operatorNodeId[msg.sender] = nodeId;

        emit NodeRegistered(nodeId, msg.sender, rolePreference, msg.value);
    }

    function addStake(uint256 nodeId) external payable {
        Node storage node = nodes[nodeId];
        require(node.operator == msg.sender, "not node operator");
        require(msg.value > 0, "stake required");
        node.stake += msg.value;
        emit StakeAdded(nodeId, msg.value);
    }

    function yeetTask(
        string calldata name,
        string calldata taskType,
        uint256 redundancyFactor,
        uint256 difficulty,
        uint256 verificationThreshold,
        uint256 executionTimeout
    ) external payable returns (uint256 taskId) {
        require(msg.value > 0, "reward required");
        require(redundancyFactor >= 2, "redundancy too low");

        taskId = nextTaskId++;
        tasks[taskId] = Task({
            requester: msg.sender,
            name: name,
            taskType: taskType,
            rewardPool: msg.value,
            redundancyFactor: redundancyFactor,
            difficulty: difficulty,
            verificationThreshold: verificationThreshold,
            executionTimeout: executionTimeout,
            verifiedDigest: bytes32(0),
            state: TaskState.Open
        });

        emit TaskYeeted(taskId, msg.sender, taskType, msg.value);
    }

    function resolveTask(
        uint256 taskId,
        bytes32 verifiedDigest,
        uint256[] calldata rewardNodeIds,
        uint256[] calldata rewardAmounts,
        string[] calldata rewardReasons,
        uint256[] calldata slashedNodeIds,
        uint256[] calldata slashAmounts,
        string[] calldata slashReasons
    ) external onlyOrchestrator {
        Task storage task = tasks[taskId];
        require(task.state == TaskState.Open || task.state == TaskState.Assigned, "task closed");
        require(rewardNodeIds.length == rewardAmounts.length && rewardNodeIds.length == rewardReasons.length, "bad reward arrays");
        require(slashedNodeIds.length == slashAmounts.length && slashedNodeIds.length == slashReasons.length, "bad slash arrays");

        uint256 totalRewards = 0;
        for (uint256 i = 0; i < rewardAmounts.length; i++) {
            totalRewards += rewardAmounts[i];
        }
        require(totalRewards <= task.rewardPool, "reward overflow");

        task.verifiedDigest = verifiedDigest;
        task.state = TaskState.Resolved;

        for (uint256 i = 0; i < slashedNodeIds.length; i++) {
            Node storage node = nodes[slashedNodeIds[i]];
            uint256 slashAmount = slashAmounts[i] > node.stake ? node.stake : slashAmounts[i];
            node.stake -= slashAmount;
            node.fraudHistory += 1;
            emit NodeSlashed(taskId, slashedNodeIds[i], slashAmount, slashReasons[i]);
        }

        for (uint256 i = 0; i < rewardNodeIds.length; i++) {
            Node storage node = nodes[rewardNodeIds[i]];
            node.rewardsEarned += rewardAmounts[i];
            payable(node.operator).transfer(rewardAmounts[i]);
            emit RewardPaid(taskId, rewardNodeIds[i], rewardAmounts[i], rewardReasons[i]);
        }

        emit TaskResolved(taskId, verifiedDigest);
    }

    function setOrchestrator(address newOrchestrator) external onlyOrchestrator {
        require(newOrchestrator != address(0), "zero orchestrator");
        orchestrator = newOrchestrator;
    }
}
