// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract YeetProtocol {

    // -------------------------
    // ENUMS
    // -------------------------

    enum Role {
        Executor,
        Validator,
        Challenger
    }

    enum TaskState {
        Open,
        Settled,
        Cancelled
    }

    // -------------------------
    // CORE STRUCTS
    // -------------------------

    struct Node {
        address operator;
        uint256 stake;
        uint256 reliability;
        uint256 reputation; // dynamic score updated via outcomes
        bool active;
    }

    struct Task {
        address requester;
        string name;
        string taskType;

        uint256 rewardPool;
        uint256 redundancyFactor;
        uint256 difficulty; // verification cost tier (IMPORTANT)

        TaskState state;
        bytes32 finalResult;

        uint256 createdAt;
    }

    struct Claim {
        uint256 taskId;
        uint256 nodeId;

        bytes32 resultHash;
        Role role;

        uint256 confidence; // optional subjective confidence (0-100)
        bool isChallengerClaim;
    }

    struct Settlement {
        bytes32 canonicalResult;
        uint256 totalWeight;
    }

    // -------------------------
    // STORAGE
    // -------------------------

    uint256 public nextTaskId = 1;
    uint256 public nextNodeId = 1;

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Node) public nodes;

    mapping(uint256 => Claim[]) public taskClaims;
    mapping(address => uint256) public nodeByOperator;

    // -------------------------
    // EVENTS
    // -------------------------

    event NodeRegistered(uint256 nodeId, address operator, uint256 stake);
    event TaskCreated(uint256 taskId, address requester, uint256 rewardPool);
    event ClaimSubmitted(uint256 taskId, uint256 nodeId, bytes32 resultHash, Role role);
    event TaskSettled(uint256 taskId, bytes32 canonicalResult);

    // -------------------------
    // NODE REGISTRATION
    // -------------------------

    function registerNode(uint256 reliability) external payable returns (uint256) {
        require(msg.value > 0, "stake required");
        require(nodeByOperator[msg.sender] == 0, "already registered");

        uint256 nodeId = nextNodeId++;

        nodes[nodeId] = Node({
            operator: msg.sender,
            stake: msg.value,
            reliability: reliability,
            reputation: 100,
            active: true
        });

        nodeByOperator[msg.sender] = nodeId;

        emit NodeRegistered(nodeId, msg.sender, msg.value);
        return nodeId;
    }

    // -------------------------
    // TASK CREATION
    // -------------------------

    function createTask(
        string calldata name,
        string calldata taskType,
        uint256 redundancyFactor,
        uint256 difficulty
    ) external payable returns (uint256) {
        require(msg.value > 0, "reward required");
        require(redundancyFactor >= 2, "bad redundancy");

        uint256 taskId = nextTaskId++;

        tasks[taskId] = Task({
            requester: msg.sender,
            name: name,
            taskType: taskType,
            rewardPool: msg.value,
            redundancyFactor: redundancyFactor,
            difficulty: difficulty,
            state: TaskState.Open,
            finalResult: bytes32(0),
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, msg.sender, msg.value);
        return taskId;
    }

    // -------------------------
    // CLAIM SUBMISSION (EPISTEMIC LAYER)
    // -------------------------

    function submitClaim(
        uint256 taskId,
        bytes32 resultHash,
        Role role,
        uint256 confidence,
        bool isChallengerClaim
    ) external {
        uint256 nodeId = nodeByOperator[msg.sender];
        require(nodeId != 0, "not registered");

        Task storage task = tasks[taskId];
        require(task.state == TaskState.Open, "task not open");

        taskClaims[taskId].push(Claim({
            taskId: taskId,
            nodeId: nodeId,
            resultHash: resultHash,
            role: role,
            confidence: confidence,
            isChallengerClaim: isChallengerClaim
        }));

        emit ClaimSubmitted(taskId, nodeId, resultHash, role);
    }

    // -------------------------
    // SETTLEMENT FUNCTION (TRUTH COLLAPSE)
    // -------------------------

    function settleTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.state == TaskState.Open, "already settled");

        Claim[] storage claims = taskClaims[taskId];

        require(claims.length > 0, "no claims");

        // -------------------------
        // SCORE AGGREGATION
        // -------------------------

        bytes32 bestResult;
        uint256 bestScore = 0;

        for (uint256 i = 0; i < claims.length; i++) {

            Claim storage c = claims[i];
            Node storage n = nodes[c.nodeId];

            uint256 baseWeight =
                n.stake +
                (n.reliability * 10) +
                n.reputation;

            uint256 roleWeight = 1;

            if (c.role == Role.Executor) {
                roleWeight = 3;
            } else if (c.role == Role.Validator) {
                roleWeight = 2;
            } else if (c.role == Role.Challenger && c.isChallengerClaim) {
                roleWeight = 4;
            }

            uint256 score = baseWeight * roleWeight * (c.confidence + 1);

            // first-time initialization
            if (i == 0 || score > bestScore) {
                bestScore = score;
                bestResult = c.resultHash;
            }
        }

        task.finalResult = bestResult;
        task.state = TaskState.Settled;

        emit TaskSettled(taskId, bestResult);

        // -------------------------
        // REPUTATION UPDATE (SIMPLE FORM)
        // -------------------------

        for (uint256 i = 0; i < claims.length; i++) {
            Claim storage c = claims[i];
            Node storage n = nodes[c.nodeId];

            if (c.resultHash == bestResult) {
                n.reputation += 5;
            } else {
                if (c.isChallengerClaim) {
                    n.reputation += 3; // rewarded for correct challenge attempt
                } else {
                    n.reputation -= 2;
                }
            }
        }

        // -------------------------
        // PAYOUT DISTRIBUTION (SIMPLIFIED)
        // -------------------------

        uint256 pool = task.rewardPool;

        for (uint256 i = 0; i < claims.length; i++) {
            Claim storage c = claims[i];
            Node storage n = nodes[c.nodeId];

            if (c.resultHash == bestResult) {
                uint256 payout = pool / claims.length;
                payable(n.operator).transfer(payout);
            }
        }
    }
}