import {
  ConsensusRound,
  DemoSwarm,
  ExecutionOutput,
  NodeRole,
  RewardEvent,
  TaskType,
  YeetNode,
  YeetTaskInput
} from "@/app/types/yeet";

const roleCycle: NodeRole[] = ["executor", "validator", "challenger", "hybrid"];

const hardware = [
  { label: "RTX 3070 dorm rig", gpuScore: 82, vramGb: 8, ramGb: 32 },
  { label: "M2 Max laptop", gpuScore: 76, vramGb: 16, ramGb: 64 },
  { label: "RX 7800 XT desktop", gpuScore: 86, vramGb: 16, ramGb: 32 },
  { label: "RTX 4090 creator box", gpuScore: 98, vramGb: 24, ramGb: 64 },
  { label: "Steam Deck cluster", gpuScore: 44, vramGb: 4, ramGb: 16 },
  { label: "GTX 1660 spare tower", gpuScore: 55, vramGb: 6, ramGb: 16 },
  { label: "Arc A770 media PC", gpuScore: 70, vramGb: 16, ramGb: 32 },
  { label: "RTX 3060 student node", gpuScore: 68, vramGb: 12, ramGb: 32 },
  { label: "Framework eGPU dock", gpuScore: 62, vramGb: 8, ramGb: 32 },
  { label: "Mini ITX render cube", gpuScore: 89, vramGb: 20, ramGb: 64 }
];

const aliases = ["VANTA", "KITE", "MORSE", "ION", "NOVA", "HALO", "CIPHER", "AXON", "QUILL", "RIFT"];

/** Internal claim mirror of on-chain Claim struct — not exported. */
type SimClaim = {
  taskId: string;
  nodeId: string;
  resultHash: string;
  role: NodeRole;
  confidence: number;
  isChallengerClaim: boolean;
};

export const defaultTask: YeetTaskInput = {
  name: "Solana settlement correctness pulse",
  type: "matrix",
  rewardPool: 1,
  redundancyFactor: 1,
  difficulty: 1,
  verificationThreshold: 40,
  executionTimeout: 18
};

export const taskLabels: Record<TaskType, string> = {
  matrix: "Matrix multiplication",
  image: "Image processing",
  hashing: "Hashing task",
  "ai-inference": "Lightweight AI inference simulation",
  rendering: "Rendering simulation"
};

export function createMockNodes(count = 10): YeetNode[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const radius = 34 + (index % 3) * 8;
    const rolePreference = roleCycle[index % roleCycle.length];

    return {
      id: `node-${String(index + 1).padStart(2, "0")}`,
      alias: aliases[index] ?? `NODE-${index + 1}`,
      stake: 180 + index * 42,
      reliability: 64 + ((index * 11) % 35),
      reputation: 100,
      active: true,
      hardware: hardware[index % hardware.length],
      uptimeScore: 72 + ((index * 9) % 26),
      rolePreference,
      activeRole: rolePreference,
      status: index % 5 === 0 ? "bidding" : "idle",
      rewardsEarned: 24 + index * 7,
      fraudHistory: index === 6 ? 2 : index === 3 ? 1 : 0,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius
    };
  });
}

/** Mirrors contract node selection: stake + reliability + uptime + hardware − difficulty penalty. */
export function selectSwarm(nodes: YeetNode[], taskInput: YeetTaskInput): YeetNode[] {
  return [...nodes]
    .filter((node) => node.active)
    .sort((a, b) => nodeScore(b, taskInput) - nodeScore(a, taskInput))
    .slice(0, Math.max(taskInput.redundancyFactor + 2, 7));
}

export function buildDemoSwarm(taskInput: YeetTaskInput = defaultTask): DemoSwarm {
  const nodes = createMockNodes();
  const selected = selectSwarm(nodes, taskInput);
  const selectedIds = new Set(selected.map((node) => node.id));
  const challenger =
    selected.find((node) => node.rolePreference === "challenger") ?? selected[selected.length - 1];

  const truthHash = resultHash(taskInput, "truth");
  const fraudHash = resultHash(taskInput, "malicious-minority");

  const participantCount = Math.max(1, Math.min(8, Math.floor(Number(taskInput.redundancyFactor) || 1)));
  const participants = selected.slice(0, participantCount);
  const maliciousNode =
    participants.find((node) => node.fraudHistory > 0) ??
    participants[3] ??
    participants[participants.length - 1] ??
    selected[0];

  const outputs: ExecutionOutput[] = participants.map((node, index) => {
    const executorSlots = Math.min(3, participants.length);
    const role: NodeRole = index < executorSlots ? "executor" : "validator";
    const isMalicious = maliciousNode ? node.id === maliciousNode.id : false;

    return {
      nodeId: node.id,
      role,
      digest: isMalicious ? fraudHash : truthHash,
      confidence: isMalicious ? 38 : 82 + index * 3,
      malicious: isMalicious,
      latencyMs: 620 + index * 180
    };
  });

  const taskId = `task-${hashSeed(taskInput.name)}`;

  const executorClaims: SimClaim[] = outputs
    .filter((output) => output.role === "executor")
    .map((output) => ({
      taskId,
      nodeId: output.nodeId,
      resultHash: output.digest,
      role: "executor",
      confidence: output.confidence,
      isChallengerClaim: false
    }));

  const initialTruth = executorClaims[0]?.resultHash ?? truthHash;

  const validatorClaims: SimClaim[] = outputs
    .filter((output) => output.role === "validator")
    .map((output) => ({
      taskId,
      nodeId: output.nodeId,
      resultHash: output.digest,
      role: "validator",
      confidence: output.confidence,
      isChallengerClaim: false
    }));

  const preChallengeClaims = [...executorClaims, ...validatorClaims];
  const preChallengeTruth = clusterConsensus(preChallengeClaims, selected);

  const challengerClaim: SimClaim = {
    taskId,
    nodeId: challenger.id,
    resultHash: truthHash,
    role: "challenger",
    confidence: 91,
    isChallengerClaim: true
  };

  const slashedNodeIds = maliciousNode && outputs.some((output) => output.malicious) ? [maliciousNode.id] : [];

  const allClaims = [...preChallengeClaims, challengerClaim];
  const canonicalResult = clusterConsensus(allClaims, selected);
  const challengeFlippedConsensus =
    canonicalResult !== preChallengeTruth &&
    challengerClaim.resultHash === canonicalResult;
  const challengeValid =
    slashedNodeIds.length > 0 && challengerClaim.resultHash === canonicalResult;

  const rewardEvents = distributeRewards({
    taskInput,
    claims: allClaims,
    canonicalResult,
    outputs,
    challengerId: challenger.id,
    slashedNodeIds,
    nodes: selected,
    challengeValid,
    challengeFlipped: challengeFlippedConsensus
  });

  const reputationDeltas = computeReputationDeltas(allClaims, canonicalResult, selected);

  const updatedNodes = nodes.map((node) => {
    if (!selectedIds.has(node.id)) return driftNode(node);

    const output = outputs.find((entry) => entry.nodeId === node.id);
    const reward = rewardEvents.find((entry) => entry.nodeId === node.id);
    const repDelta = reputationDeltas.get(node.id) ?? 0;
    const isSlashed = slashedNodeIds.includes(node.id);

    let status: YeetNode["status"] = "assigned";
    if (isSlashed) status = "slashed";
    else if (reward && reward.delta > 0) status = "rewarded";

    return {
      ...node,
      activeRole: node.id === challenger.id ? "challenger" : (output?.role ?? node.rolePreference),
      status,
      reputation: Math.max(0, node.reputation + repDelta),
      fraudHistory: isSlashed ? node.fraudHistory + 1 : node.fraudHistory,
      stake: isSlashed ? Math.round(node.stake * 0.72) : node.stake,
      rewardsEarned: node.rewardsEarned + Math.max(0, reward?.delta ?? 0)
    };
  });

  const rounds: ConsensusRound[] = [
    {
      state: "queued",
      title: "Task queued",
      description: `${taskInput.name} enters the market with ${taskInput.rewardPool} YEET escrow, redundancy ${taskInput.redundancyFactor}, difficulty ${taskInput.difficulty}.`,
      outputs: [],
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "forming",
      title: "Swarm formation",
      description: "Nodes bid by stake, reliability, uptime, and hardware capability. Temporary swarm forms around redundancy requirement.",
      outputs: [],
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "assigned",
      title: "Role assignment",
      description: `${selected.length} nodes assigned as executors, validators, and challenger based on role preference and selection score.`,
      outputs: [],
      challengerId: challenger.id,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "executing",
      title: "Redundant execution",
      description: `Executors compute independently. Initial truth = first valid hash (${initialTruth.slice(0, 14)}…). One node injects divergent output.`,
      outputs: outputs.filter((output) => output.role === "executor"),
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "validating",
      title: "Validator agreement",
      description: `Validators verify outputs. Provisional consensus cluster: ${preChallengeTruth.slice(0, 14)}… (weighted by stake + reliability + reputation).`,
      outputs,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "challenged",
      title: "Challenge initiated",
      description: `${challenger.alias} disputes inconsistent digest with challenger-weighted claim (roleWeight=4).${
        challengeFlippedConsensus ? " Challenger claim shifts weighted consensus." : ""
      } Truth is not final until re-scored.`,
      outputs,
      challengerId: challenger.id,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "slashing",
      title: "Malicious execution proven",
      description: maliciousNode
        ? `${maliciousNode.alias} submitted fraudulent digest. Stake slashed; reputation penalized per protocol rules.`
        : "Divergent digest detected. Stake slashed; reputation penalized per protocol rules.",
      outputs,
      challengerId: challenger.id,
      slashedNodeIds,
      rewardEvents: rewardEvents.filter((event) => event.delta < 0)
    },
    {
      state: "resolved",
      title: "Canonical truth settled",
      description: `Final truth = highest weighted cluster (${canonicalResult.slice(0, 14)}…). Rewards distributed by role, correctness, and challenge outcome. On-chain resolve_task result overrides this when live settlement is available.`,
      outputs,
      challengerId: challenger.id,
      slashedNodeIds,
      rewardEvents,
      verifiedDigest: canonicalResult
    }
  ];

  return {
    task: taskInput,
    nodes: updatedNodes,
    assignedNodeIds: selected.map((node) => node.id),
    rounds,
    verifiedResult: canonicalResult
    // Note: verifiedResult is simulation-only; on-chain canonical_result from resolve_task is authoritative in live mode.
  };
}

function nodeScore(node: YeetNode, taskInput: YeetTaskInput): number {
  const reliabilityWeight = node.reliability * 1.8;
  const hardwareWeight =
    node.hardware.gpuScore + node.hardware.vramGb * 2 + node.hardware.ramGb * 0.5;
  const stakeWeight = Math.min(node.stake / 8, 80);
  const reputationWeight = node.reputation * 0.5;
  const roleBonus =
    node.rolePreference === "executor"
      ? 12
      : node.rolePreference === "validator"
        ? 8
        : node.rolePreference === "challenger"
          ? 6
          : 4;
  const difficultyPenalty = Math.max(0, taskInput.difficulty * 4 - node.hardware.vramGb);

  return (
    reliabilityWeight +
    hardwareWeight +
    stakeWeight +
    reputationWeight +
    node.uptimeScore +
    roleBonus -
    difficultyPenalty
  );
}

/** Mirrors YeetProtocol.sol scoreClaim: baseWeight × roleWeight × (confidence + 1). */
function scoreClaim(claim: SimClaim, node: YeetNode): number {
  const baseWeight = node.stake + node.reliability * 10 + node.reputation;

  let roleWeight = 1;
  if (claim.role === "executor") roleWeight = 3;
  else if (claim.role === "validator") roleWeight = 2;
  else if (claim.role === "challenger" && claim.isChallengerClaim) roleWeight = 4;

  return baseWeight * roleWeight * (claim.confidence + 1);
}

/** Aggregate scores by resultHash cluster — final truth = highest-weight cluster. */
function clusterConsensus(claims: SimClaim[], nodes: YeetNode[]): string {
  const clusters = new Map<string, number>();

  for (const claim of claims) {
    const node = nodes.find((candidate) => candidate.id === claim.nodeId);
    if (!node) continue;
    const score = scoreClaim(claim, node);
    clusters.set(claim.resultHash, (clusters.get(claim.resultHash) ?? 0) + score);
  }

  let bestHash = "";
  let bestScore = 0;

  for (const [hash, score] of Array.from(clusters.entries())) {
    if (score > bestScore) {
      bestScore = score;
      bestHash = hash;
    }
  }

  return bestHash;
}

/** Mirrors contract reputation update loop in settleTask. */
function computeReputationDeltas(
  claims: SimClaim[],
  canonicalResult: string,
  nodes: YeetNode[]
): Map<string, number> {
  const deltas = new Map<string, number>();

  for (const claim of claims) {
    const node = nodes.find((candidate) => candidate.id === claim.nodeId);
    if (!node) continue;

    const current = deltas.get(claim.nodeId) ?? 0;
    if (claim.resultHash === canonicalResult) {
      deltas.set(claim.nodeId, current + 5);
    } else if (claim.isChallengerClaim) {
      deltas.set(claim.nodeId, current + 3);
    } else {
      deltas.set(claim.nodeId, current - 2);
    }
  }

  return deltas;
}

function distributeRewards({
  taskInput,
  claims,
  canonicalResult,
  outputs,
  challengerId,
  slashedNodeIds,
  nodes,
  challengeValid,
  challengeFlipped
}: {
  taskInput: YeetTaskInput;
  claims: SimClaim[];
  canonicalResult: string;
  outputs: ExecutionOutput[];
  challengerId: string;
  slashedNodeIds: string[];
  nodes: YeetNode[];
  challengeValid: boolean;
  challengeFlipped: boolean;
}): RewardEvent[] {
  const slashed = new Set(slashedNodeIds);
  const matchingClaims = claims.filter((claim) => claim.resultHash === canonicalResult);
  const perClaimPayout =
    matchingClaims.length > 0 ? Math.round(taskInput.rewardPool / matchingClaims.length) : 0;

  const positive: RewardEvent[] = matchingClaims.map((claim) => {
    const node = nodes.find((candidate) => candidate.id === claim.nodeId);
    const output = outputs.find((entry) => entry.nodeId === claim.nodeId);
    const isValidator = claim.role === "validator";
    const isExecutor = claim.role === "executor";

    let reason = "matched canonical result";
    if (isExecutor) reason = "executed correct workload";
    else if (isValidator) reason = "verified correct digest";

    const roleMultiplier = isValidator ? 0.65 : 1;
    const delta = Math.round(perClaimPayout * roleMultiplier);

    return {
      nodeId: claim.nodeId,
      label: node?.alias ?? claim.nodeId,
      delta,
      reason
    };
  });

  const challenger = nodes.find((node) => node.id === challengerId);
  const challengerEvents: RewardEvent[] = challengeValid
    ? [
        {
          nodeId: challengerId,
          label: challenger?.alias ?? challengerId,
          delta: Math.round(taskInput.rewardPool * 0.12 + taskInput.rewardPool * 0.08),
          reason: challengeFlipped
            ? "valid challenge flipped consensus"
            : "valid challenge proved fraud"
        }
      ]
    : [];

  const negative: RewardEvent[] = Array.from(slashed).map((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    return {
      nodeId,
      label: node?.alias ?? nodeId,
      delta: -Math.round((node?.stake ?? 250) * 0.28),
      reason: "submitted fraudulent digest"
    };
  });

  return [...positive, ...challengerEvents, ...negative];
}

/** Deterministic digest for on-chain claims — matches simulation truth/fraud hashes. */
export function computeTaskDigest(taskInput: YeetTaskInput, salt: string): string {
  return resultHash(taskInput, salt);
}

function resultHash(taskInput: YeetTaskInput, salt: string): string {
  const seed = `${taskInput.name}:${taskInput.type}:${taskInput.difficulty}:${salt}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, "0")}${taskInput.type.slice(0, 2)}`;
}

function hashSeed(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 6);
}

function driftNode(node: YeetNode): YeetNode {
  return {
    ...node,
    x: Math.max(8, Math.min(92, node.x + (node.id.endsWith("1") ? 2 : -1))),
    y: Math.max(8, Math.min(92, node.y + (node.id.endsWith("2") ? -2 : 1)))
  };
}
