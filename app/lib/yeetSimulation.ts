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

export const defaultTask: YeetTaskInput = {
  name: "Solana settlement correctness pulse",
  type: "matrix",
  rewardPool: 1200,
  redundancyFactor: 5,
  difficulty: 7,
  verificationThreshold: 72,
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
      hardware: hardware[index % hardware.length],
      uptimeScore: 72 + ((index * 9) % 26),
      reliabilityScore: 64 + ((index * 11) % 35),
      stake: 180 + index * 42,
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

export function selectSwarm(nodes: YeetNode[], task: YeetTaskInput): YeetNode[] {
  return [...nodes]
    .sort((a, b) => nodeScore(b, task) - nodeScore(a, task))
    .slice(0, Math.max(task.redundancyFactor + 2, 7));
}

export function buildDemoSwarm(task: YeetTaskInput = defaultTask): DemoSwarm {
  const nodes = createMockNodes();
  const selected = selectSwarm(nodes, task);
  const selectedIds = new Set(selected.map((node) => node.id));
  const maliciousNode = selected[3];
  const challenger = selected.find((node) => node.rolePreference === "challenger") ?? selected[selected.length - 1];
  const verifiedDigest = digestFor(task, "truth");
  const fraudulentDigest = digestFor(task, "malicious-minority");

  const outputs: ExecutionOutput[] = selected.slice(0, task.redundancyFactor).map((node, index) => ({
    nodeId: node.id,
    role: index < 3 ? "executor" : "validator",
    digest: node.id === maliciousNode.id ? fraudulentDigest : verifiedDigest,
    confidence: node.id === maliciousNode.id ? 38 : 82 + index * 3,
    malicious: node.id === maliciousNode.id,
    latencyMs: 620 + index * 180
  }));

  const rewardEvents = distributeRewards({
    task,
    outputs,
    challengerId: challenger.id,
    slashedNodeIds: [maliciousNode.id],
    nodes: selected
  });

  const updatedNodes = nodes.map((node) => {
    if (!selectedIds.has(node.id)) return driftNode(node);
    const output = outputs.find((entry) => entry.nodeId === node.id);
    const reward = rewardEvents.find((entry) => entry.nodeId === node.id);
    const status: YeetNode["status"] = node.id === maliciousNode.id ? "slashed" : reward ? "rewarded" : "assigned";

    return {
      ...node,
      activeRole: node.id === challenger.id ? "challenger" : output?.role ?? node.rolePreference,
      status,
      fraudHistory: node.id === maliciousNode.id ? node.fraudHistory + 1 : node.fraudHistory,
      stake: node.id === maliciousNode.id ? Math.round(node.stake * 0.72) : node.stake,
      rewardsEarned: node.rewardsEarned + Math.max(0, reward?.delta ?? 0)
    };
  });

  const rounds: ConsensusRound[] = [
    {
      state: "queued",
      title: "Task queued",
      description: "The request enters the task market with reward escrow, redundancy, verification threshold, and execution timeout.",
      outputs: [],
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "forming",
      title: "Ephemeral swarm formation",
      description: "Idle consumer hardware bids with stake, reliability, and capability. A temporary off-chain swarm forms around the task.",
      outputs: [],
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "assigned",
      title: "Node assignment",
      description: "Executors, validators, and a challenger receive the task assignment and begin heartbeat-tracked participation.",
      outputs: [],
      challengerId: challenger.id,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "executing",
      title: "Redundant execution",
      description: "Executors compute independently before settlement. One node submits a fraudulent digest to test the correctness market.",
      outputs: outputs.slice(0, 3),
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "receipts",
      title: "Signed receipts",
      description: "Nodes attach signed execution receipts to their digests so the coordinator can verify authorship before scoring.",
      outputs,
      challengerId: challenger.id,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "validating",
      title: "Validator comparison",
      description: "Validators compare digests and confidence. Agreement forms, but economically useful dissent stays valuable.",
      outputs,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "challenged",
      title: "Challenge initiated",
      description: `${challenger.alias} disputes the inconsistent digest. YEET rewards nodes for proving the network wrong.`,
      outputs,
      challengerId: challenger.id,
      slashedNodeIds: [],
      rewardEvents: []
    },
    {
      state: "slashing",
      title: "Fraud proven",
      description: `${maliciousNode.alias} loses stake. The future Solana program would settle the slash and update node reputation.`,
      outputs,
      challengerId: challenger.id,
      slashedNodeIds: [maliciousNode.id],
      rewardEvents: rewardEvents.filter((event) => event.delta < 0)
    },
    {
      state: "resolved",
      title: "Verified result returned",
      description: "Rewards are distributed by execution, validation, challenge proof, and reliability: off-chain compute, on-chain accountability.",
      outputs,
      challengerId: challenger.id,
      slashedNodeIds: [maliciousNode.id],
      rewardEvents,
      verifiedDigest
    }
  ];

  return {
    task,
    nodes: updatedNodes,
    assignedNodeIds: selected.map((node) => node.id),
    rounds,
    verifiedResult: verifiedDigest
  };
}

function nodeScore(node: YeetNode, task: YeetTaskInput) {
  const reliabilityWeight = node.reliabilityScore * 1.8;
  const hardwareWeight = node.hardware.gpuScore + node.hardware.vramGb * 2 + node.hardware.ramGb * 0.5;
  const stakeWeight = Math.min(node.stake / 8, 80);
  const difficultyPenalty = Math.max(0, task.difficulty * 4 - node.hardware.vramGb);

  return reliabilityWeight + hardwareWeight + stakeWeight + node.uptimeScore - difficultyPenalty;
}

function distributeRewards({
  task,
  outputs,
  challengerId,
  slashedNodeIds,
  nodes
}: {
  task: YeetTaskInput;
  outputs: ExecutionOutput[];
  challengerId: string;
  slashedNodeIds: string[];
  nodes: YeetNode[];
}): RewardEvent[] {
  const slashed = new Set(slashedNodeIds);
  const correctOutputs = outputs.filter((output) => !output.malicious);
  const basePool = task.rewardPool * 0.72;
  const validatorPool = task.rewardPool * 0.16;
  const challengePool = task.rewardPool * 0.12;
  const correctnessWeight = correctOutputs.reduce((sum, output) => {
    const node = nodes.find((candidate) => candidate.id === output.nodeId);
    return sum + output.confidence + (node?.reliabilityScore ?? 70) * 0.6;
  }, 0);

  const positive = correctOutputs.map((output) => {
    const node = nodes.find((candidate) => candidate.id === output.nodeId);
    const roleBonus = output.role === "validator" ? validatorPool / Math.max(1, correctOutputs.length) : 0;
    const weightedShare = ((output.confidence + (node?.reliabilityScore ?? 70) * 0.6) / correctnessWeight) * basePool;
    return {
      nodeId: output.nodeId,
      label: node?.alias ?? output.nodeId,
      delta: Math.round(weightedShare + roleBonus),
      reason: output.role === "validator" ? "verified correct digest" : "executed correct workload"
    };
  });

  const challenger = nodes.find((node) => node.id === challengerId);
  const challengeBonus: RewardEvent = {
    nodeId: challengerId,
    label: challenger?.alias ?? challengerId,
    delta: Math.round(challengePool + task.rewardPool * 0.08),
    reason: "proved network divergence"
  };

  const negative = Array.from(slashed).map((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    return {
      nodeId,
      label: node?.alias ?? nodeId,
      delta: -Math.round((node?.stake ?? 250) * 0.28),
      reason: "submitted fraudulent digest"
    };
  });

  return [...positive, challengeBonus, ...negative];
}

function digestFor(task: YeetTaskInput, salt: string) {
  const seed = `${task.name}:${task.type}:${task.difficulty}:${salt}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, "0")}${task.type.slice(0, 2)}`;
}

function driftNode(node: YeetNode): YeetNode {
  return {
    ...node,
    x: Math.max(8, Math.min(92, node.x + (node.id.endsWith("1") ? 2 : -1))),
    y: Math.max(8, Math.min(92, node.y + (node.id.endsWith("2") ? -2 : 1)))
  };
}
