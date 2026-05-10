export type TaskType = "matrix" | "image" | "hashing" | "ai-inference" | "rendering";

export type NodeRole = "executor" | "validator" | "challenger" | "hybrid";

export type ConsensusState =
  | "queued"
  | "forming"
  | "assigned"
  | "executing"
  | "receipts"
  | "validating"
  | "challenged"
  | "slashing"
  | "resolved";

export type HardwareProfile = {
  label: string;
  gpuScore: number;
  vramGb: number;
  ramGb: number;
};

export type YeetNode = {
  id: string;
  alias: string;
  hardware: HardwareProfile;
  uptimeScore: number;
  reliabilityScore: number;
  stake: number;
  rolePreference: NodeRole;
  activeRole: NodeRole;
  status: "idle" | "bidding" | "assigned" | "executing" | "validating" | "challenging" | "slashed" | "rewarded";
  rewardsEarned: number;
  fraudHistory: number;
  x: number;
  y: number;
};

export type YeetTaskInput = {
  name: string;
  type: TaskType;
  rewardPool: number;
  redundancyFactor: number;
  difficulty: number;
  verificationThreshold: number;
  executionTimeout: number;
};

export type ExecutionOutput = {
  nodeId: string;
  role: NodeRole;
  digest: string;
  confidence: number;
  malicious: boolean;
  latencyMs: number;
  receipt?: ExecutionReceipt;
};

export type RewardEvent = {
  nodeId: string;
  label: string;
  delta: number;
  reason: string;
};

export type ConsensusRound = {
  state: ConsensusState;
  title: string;
  description: string;
  outputs: ExecutionOutput[];
  challengerId?: string;
  slashedNodeIds: string[];
  rewardEvents: RewardEvent[];
  verifiedDigest?: string;
};

export type DemoSwarm = {
  task: YeetTaskInput;
  nodes: YeetNode[];
  assignedNodeIds: string[];
  rounds: ConsensusRound[];
  verifiedResult: string;
};

export type ExecutionReceipt = {
  receiptId: string;
  taskId: string;
  nodeId: string;
  digest: string;
  role: NodeRole;
  issuedAt: number;
  publicKey: string;
  signature: string;
  verified: boolean;
};

export type NodeReputation = {
  nodeId: string;
  reputationScore: number;
  slashCount: number;
  successfulValidations: number;
  challengeWins: number;
  maliciousFlags: number;
  lastSeen: number;
};

export type MarketplaceTask = {
  id: string;
  name: string;
  type: TaskType;
  status: "queued" | "active" | "completed" | "failed";
  rewardPool: number;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type SwarmLogEvent = {
  id: string;
  ts: number;
  level: "info" | "success" | "warn" | "danger";
  message: string;
};

export type SwarmMetrics = {
  connectedNodes: number;
  heartbeatsPerMinute: number;
  receiptsVerified: number;
  invalidReceipts: number;
  queuedTasks: number;
  activeTasks: number;
  completedTasks: number;
  slashedNodes: number;
};

export type SwarmSocketSnapshot = {
  connected: boolean;
  nodes: YeetNode[];
  assignedNodeIds: string[];
  currentRound?: ConsensusRound;
  receipts: ExecutionReceipt[];
  reputation: NodeReputation[];
  tasks: MarketplaceTask[];
  logs: SwarmLogEvent[];
  metrics: SwarmMetrics;
};
