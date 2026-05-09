export type TaskType = "matrix" | "image" | "hashing" | "ai-inference" | "rendering";

export type NodeRole = "executor" | "validator" | "challenger" | "hybrid";

export type ConsensusState =
  | "forming"
  | "executing"
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
