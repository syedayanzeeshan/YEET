import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl
} from "@solana/web3.js";
import bs58 from "bs58";
import type { YeetTaskInput } from "@/app/types/yeet";

// ── Program identity ──────────────────────────────────────────────────────────

export const YEET_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ??
    process.env.NEXT_PUBLIC_YEET_PROGRAM_ID ??
    "4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd"
);

export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function isLiveProgramConfigured(): boolean {
  const id =
    process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ??
    process.env.NEXT_PUBLIC_YEET_PROGRAM_ID ??
    "";
  return id.length > 0 && !id.startsWith("Yeet111");
}

// ── Instruction discriminators (sha256("global:<name>")[0..8]) ────────────────

const IX_CREATE_TASK           = Buffer.from([194,  80,   6, 180, 232, 127,  48, 171]);
const IX_SUBMIT_CLAIM          = Buffer.from([163, 108, 111,  46, 220,  82,  77, 212]);
const IX_RESOLVE_TASK          = Buffer.from([116, 245, 180, 251,  30, 233, 101,  33]);
const IX_REGISTER_NODE         = Buffer.from([102,  85, 117, 114, 194, 188, 211, 168]);
const IX_UPDATE_NODE_REPUTATION = Buffer.from([120, 102, 142,  11, 103, 202, 252, 114]);

// ── Constants mirroring the Rust program ──────────────────────────────────────

export const CHALLENGE_BOND_LAMPORTS = BigInt(5_000_000); // 0.005 SOL

// ── Public types ──────────────────────────────────────────────────────────────

export type SolanaWallet = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
};

export type OnChainTaskState = {
  taskId: bigint;
  requester: PublicKey;
  name: string;
  taskType: string;
  rewardPool: bigint;
  redundancyFactor: number;
  difficulty: number;
  verificationThreshold: number;
  executionTimeout: bigint;
  state: number;
  claimCount: number;
  canonicalResult: Uint8Array;
  address: PublicKey;
};

export type OnChainClaim = {
  address: PublicKey;
  taskId: bigint;
  node: PublicKey;
  role: number;
  resultHash: Uint8Array;
  confidence: number;
  challengeBond: bigint;
  reputationSettled: boolean;
};

export type OnChainNodeProfile = {
  address: PublicKey;
  operator: PublicKey;
  hardwareHash: Uint8Array;
  rolePreference: number;
  reputationScore: number;
  slashCount: number;
  challengeWins: number;
  totalTasks: number;
};

export type OnChainTaskHistory = {
  address: PublicKey;
  owner: PublicKey;
  count: number;
  recentTaskIds: bigint[];
};

// ── Connection ────────────────────────────────────────────────────────────────

const RPC_COMMITMENT = "confirmed" as const;

export function getConnection(): Connection {
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (custom) return new Connection(custom, RPC_COMMITMENT);
  return new Connection(
    clusterApiUrl(SOLANA_CLUSTER as "devnet" | "mainnet-beta" | "testnet"),
    RPC_COMMITMENT
  );
}

// ── PDA derivation ────────────────────────────────────────────────────────────

export function protocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], YEET_PROGRAM_ID);
}

export function taskPda(taskId: bigint | number): [PublicKey, number] {
  const id = typeof taskId === "bigint" ? taskId : BigInt(taskId);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("task"), buf], YEET_PROGRAM_ID);
}

export function claimPda(taskId: bigint | number, node: PublicKey): [PublicKey, number] {
  const id = typeof taskId === "bigint" ? taskId : BigInt(taskId);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), buf, node.toBuffer()],
    YEET_PROGRAM_ID
  );
}

export function nodePda(operator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("node"), operator.toBuffer()],
    YEET_PROGRAM_ID
  );
}

export function historyPda(requester: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("history"), requester.toBuffer()],
    YEET_PROGRAM_ID
  );
}

// ── On-chain reads ────────────────────────────────────────────────────────────

export async function fetchNextTaskId(connection = getConnection()): Promise<bigint> {
  const [protocol] = protocolPda();
  const account = await connection.getAccountInfo(protocol);
  if (!account?.data || account.data.length < 17) return BigInt(0);
  return account.data.readBigUInt64LE(8);
}

export async function fetchTaskState(
  taskId: bigint | number,
  connection = getConnection()
): Promise<OnChainTaskState | null> {
  const [address] = taskPda(taskId);
  const account = await connection.getAccountInfo(address);
  if (!account?.data) return null;
  return decodeTaskState(address, account.data);
}

export async function fetchClaimsForTask(
  taskId: bigint | number,
  connection = getConnection()
): Promise<OnChainClaim[]> {
  const id = typeof taskId === "bigint" ? taskId : BigInt(taskId);
  const taskIdBytes = Buffer.alloc(8);
  taskIdBytes.writeBigUInt64LE(id);

  // New Claim size: 8 disc + 8 task_id + 32 node + 1 role + 32 result_hash
  //                + 1 confidence + 8 challenge_bond + 1 reputation_settled + 1 bump = 92
  const accounts = await connection.getProgramAccounts(YEET_PROGRAM_ID, {
    filters: [
      { dataSize: 92 },
      { memcmp: { offset: 8, bytes: bs58.encode(taskIdBytes) } }
    ]
  });

  const claims: OnChainClaim[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      claims.push(decodeClaim(pubkey, account.data));
    } catch {
      continue;
    }
  }
  return claims;
}

export async function fetchNodeProfile(
  operator: PublicKey,
  connection = getConnection()
): Promise<OnChainNodeProfile | null> {
  const [address] = nodePda(operator);
  const account = await connection.getAccountInfo(address);
  if (!account?.data) return null;
  try {
    return decodeNodeProfile(address, account.data);
  } catch {
    return null;
  }
}

export async function fetchTaskHistory(
  requester: PublicKey,
  connection = getConnection()
): Promise<OnChainTaskHistory | null> {
  const [address] = historyPda(requester);
  const account = await connection.getAccountInfo(address);
  if (!account?.data) return null;
  try {
    return decodeTaskHistory(address, account.data);
  } catch {
    return null;
  }
}

/** Convenience: fetch every TaskState listed in the requester's history. */
export async function fetchTasksByRequester(
  requester: PublicKey,
  connection = getConnection()
): Promise<OnChainTaskState[]> {
  const history = await fetchTaskHistory(requester, connection);
  if (!history) return [];
  const tasks = await Promise.all(
    history.recentTaskIds.map((id) => fetchTaskState(id, connection))
  );
  return tasks.filter((t): t is OnChainTaskState => t !== null);
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function registerNode(
  wallet: SolanaWallet,
  hardwareLabel: string,
  rolePreference: 0 | 1 | 2 | 3 = 0
): Promise<{ signature: string; nodeProfileAddress: PublicKey }> {
  const connection = getConnection();
  const [nodeProfile] = nodePda(wallet.publicKey);

  // Hash the label into 32 bytes (UTF-8 padded / truncated)
  const hardwareHash = Buffer.alloc(32, 0);
  Buffer.from(hardwareLabel, "utf8").copy(hardwareHash, 0, 0, Math.min(32, Buffer.byteLength(hardwareLabel)));

  const data = Buffer.concat([
    IX_REGISTER_NODE,
    hardwareHash,
    Buffer.from([rolePreference])
  ]);

  const instruction = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: nodeProfile,      isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  const signature = await send(wallet, connection, transaction);
  return { signature, nodeProfileAddress: nodeProfile };
}

export async function updateNodeReputation(
  wallet: SolanaWallet,
  taskId: bigint | number,
  nodePublicKey: PublicKey
): Promise<string> {
  const connection = getConnection();
  const [taskState] = taskPda(taskId);
  const [claim]     = claimPda(taskId, nodePublicKey);
  const [nodeProfile] = nodePda(nodePublicKey);

  const instruction = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: taskState,        isSigner: false, isWritable: false },
      { pubkey: claim,            isSigner: false, isWritable: true  },
      { pubkey: nodeProfile,      isSigner: false, isWritable: true  }
    ],
    data: IX_UPDATE_NODE_REPUTATION
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  return send(wallet, connection, transaction);
}

export function normalizeTaskForChain(task: YeetTaskInput): YeetTaskInput {
  return {
    ...task,
    name: task.name.trim() || "Untitled task",
    rewardPool: Math.max(1, Math.round(task.rewardPool)),
    redundancyFactor: Math.max(1, Math.min(255, Math.round(task.redundancyFactor))),
    difficulty: Math.max(1, Math.min(255, Math.round(task.difficulty))),
    verificationThreshold: Math.max(1, Math.min(100, Math.round(task.verificationThreshold))),
    executionTimeout: Math.max(1, Math.round(task.executionTimeout))
  };
}

export function rewardPoolLamports(task: YeetTaskInput): bigint {
  return BigInt(Math.max(1, Math.round(task.rewardPool * 1_000_000)));
}

const TASK_ACCOUNT_RENT_LAMPORTS = BigInt(2_500_000);
const HISTORY_ACCOUNT_RENT_LAMPORTS = BigInt(3_200_000);

export async function createTask(
  wallet: SolanaWallet,
  task: YeetTaskInput,
  taskId?: bigint
): Promise<{ signature: string; taskId: bigint; taskAddress: PublicKey }> {
  const connection = getConnection();
  const normalized = normalizeTaskForChain(task);
  const rewardLamports = rewardPoolLamports(normalized);

  const balance = await connection.getBalance(wallet.publicKey);
  const required =
    rewardLamports +
    TASK_ACCOUNT_RENT_LAMPORTS +
    HISTORY_ACCOUNT_RENT_LAMPORTS +
    BigInt(500_000);
  if (BigInt(balance) < required) {
    throw new Error(
      `Insufficient devnet SOL (need ~${(Number(required) / 1e9).toFixed(3)} SOL including rent). Airdrop from faucet.solana.com.`
    );
  }

  let nextId = taskId ?? (await fetchNextTaskId(connection));
  const [protocolState] = protocolPda();
  const [historyAddress] = historyPda(wallet.publicKey);
  let [taskStateAddress] = taskPda(nextId);

  const buildInstruction = (id: bigint) => {
    const [tsa] = taskPda(id);
    const data = Buffer.concat([
      IX_CREATE_TASK,
      encodeU64(id),
      encodeString(normalized.name),
      encodeString(normalized.type),
      encodeU64(rewardLamports),
      Buffer.from([normalized.redundancyFactor]),
      Buffer.from([normalized.difficulty]),
      Buffer.from([normalized.verificationThreshold]),
      encodeU64(BigInt(normalized.executionTimeout))
    ]);
    return new TransactionInstruction({
      programId: YEET_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: protocolState,    isSigner: false, isWritable: true },
        { pubkey: tsa,              isSigner: false, isWritable: true },
        { pubkey: historyAddress,   isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data
    });
  };

  let transaction = new Transaction().add(buildInstruction(nextId));
  transaction.feePayer = wallet.publicKey;

  try {
    const signature = await send(wallet, connection, transaction);
    return { signature, taskId: nextId, taskAddress: taskPda(nextId)[0] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stale =
      message.includes("InvalidTaskId") ||
      message.includes("0x1775") ||
      message.includes("already in use");

    if (!taskId && stale) {
      nextId = await fetchNextTaskId(connection);
      taskStateAddress = taskPda(nextId)[0];
      transaction = new Transaction().add(buildInstruction(nextId));
      transaction.feePayer = wallet.publicKey;
      const signature = await send(wallet, connection, transaction);
      return { signature, taskId: nextId, taskAddress: taskStateAddress };
    }

    throw error;
  }
}

export function parseNodePubkey(address: string): PublicKey | null {
  try {
    return new PublicKey(address.trim());
  } catch {
    return null;
  }
}

export function resultToBytes32(value: string): Uint8Array {
  const trimmed = value.trim();
  if (trimmed.startsWith("0x")) {
    return digestToBytes32(trimmed);
  }
  const bytes = Buffer.alloc(32, 0);
  Buffer.from(trimmed, "utf8").copy(bytes, 0, 0, Math.min(32, Buffer.from(trimmed, "utf8").length));
  return bytes;
}

export function buildSubmitClaimInstruction(
  nodePubkey: PublicKey,
  taskId: bigint | number,
  role: "executor" | "validator" | "challenger",
  resultValue: string,
  confidence: number
): TransactionInstruction {
  const [taskState] = taskPda(taskId);
  const [claim]     = claimPda(taskId, nodePubkey);
  const roleByte    = role === "executor" ? 0 : role === "validator" ? 1 : 2;
  const hashBytes   = resultToBytes32(resultValue);

  const data = Buffer.concat([
    IX_SUBMIT_CLAIM,
    Buffer.from([roleByte]),
    Buffer.from(hashBytes),
    Buffer.from([Math.min(100, Math.max(0, confidence))])
  ]);

  return new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: nodePubkey, isSigner: true, isWritable: true },
      { pubkey: taskState,  isSigner: false, isWritable: true },
      { pubkey: claim,      isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data
  });
}

export async function buildSubmitClaimTransaction(
  nodePubkey: PublicKey,
  taskId: bigint | number,
  role: "executor" | "validator" | "challenger",
  resultValue: string,
  confidence: number
): Promise<Transaction> {
  const instruction = buildSubmitClaimInstruction(nodePubkey, taskId, role, resultValue, confidence);
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = nodePubkey;
  return transaction;
}

export function serializeTransaction(transaction: Transaction): string {
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

export function deserializeTransaction(encoded: string): Transaction {
  return Transaction.from(Buffer.from(encoded, "base64"));
}

export async function submitClaim(
  wallet: SolanaWallet,
  taskId: bigint | number,
  role: "executor" | "validator" | "challenger",
  resultHash: string | Uint8Array,
  confidence: number
): Promise<string> {
  const connection = getConnection();
  const resultValue = typeof resultHash === "string" ? resultHash : bytesToDigestHex(resultHash);
  const transaction = await buildSubmitClaimTransaction(
    wallet.publicKey, taskId, role, resultValue, confidence
  );
  return send(wallet, connection, transaction);
}

export async function signAndSendPreparedTransaction(
  wallet: SolanaWallet,
  encodedTransaction: string
): Promise<string> {
  const connection = getConnection();
  const transaction = deserializeTransaction(encodedTransaction);
  return send(wallet, connection, transaction);
}

export async function resolveTask(
  wallet: SolanaWallet,
  taskId: bigint | number,
  claims: OnChainClaim[]
): Promise<string> {
  const connection = getConnection();
  const [taskState] = taskPda(taskId);

  const uniqueNodes = Array.from(
    new Map(claims.map((c) => [c.node.toBase58(), c.node])).values()
  );

  const keys = [
    { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
    { pubkey: taskState,        isSigner: false, isWritable: true  },
    ...claims.map((claim) => ({
      pubkey: claim.address,
      isSigner: false,
      isWritable: false
    })),
    ...uniqueNodes.map((node) => ({
      pubkey: node,
      isSigner: false,
      isWritable: true
    }))
  ];

  const instruction = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys,
    data: IX_RESOLVE_TASK
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  return send(wallet, connection, transaction);
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const ACTIVE_TASK_STORAGE_KEY  = "yeet_active_task_id";
const PENDING_CLAIM_TX_PREFIX  = "yeet_pending_claim_tx_";

export function storeActiveTaskId(taskId: bigint | number): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACTIVE_TASK_STORAGE_KEY, String(taskId));
}

export function loadActiveTaskId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
}

export function resolveDisplayedTaskId(
  activeTaskId: bigint | null | undefined
): string | null {
  if (activeTaskId !== null && activeTaskId !== undefined) {
    return activeTaskId.toString();
  }
  return loadActiveTaskId();
}

export function clearActiveTaskId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
}

export function storePendingClaimTx(encodedTransaction: string): string {
  if (typeof window === "undefined") return "/claim/sign";
  const pendingId = `${Date.now().toString(36)}`;
  sessionStorage.setItem(`${PENDING_CLAIM_TX_PREFIX}${pendingId}`, encodedTransaction);
  return `${window.location.origin}/claim/sign?pending=${pendingId}`;
}

export function loadPendingClaimTx(pendingId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PENDING_CLAIM_TX_PREFIX}${pendingId}`);
}

export function claimSignPageUrl(encodedTransaction: string): string {
  return storePendingClaimTx(encodedTransaction);
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

export function canonicalResultHex(task: OnChainTaskState): string {
  return `0x${Buffer.from(task.canonicalResult).toString("hex")}`;
}

export function bytesToDigestHex(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes).toString("hex").replace(/(00)+$/, "");
  return hex.length > 0 ? `0x${hex}` : "0x0";
}

export function digestToBytes32(digest: string): Uint8Array {
  const cleaned = digest.startsWith("0x") ? digest.slice(2) : digest;
  const bytes = Buffer.alloc(32, 0);
  const hex = cleaned.replace(/[^0-9a-fA-F]/g, "").slice(0, 64);
  Buffer.from(hex.padEnd(64, "0"), "hex").copy(bytes);
  return bytes;
}

export function roleLabel(role: number): string {
  if (role === 0) return "executor";
  if (role === 1) return "validator";
  if (role === 2) return "challenger";
  return "unknown";
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_CLUSTER}`;
}

export function explorerAccountUrl(address: PublicKey | string): string {
  return `https://explorer.solana.com/address/${address.toString()}?cluster=${SOLANA_CLUSTER}`;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
};

export async function connectPhantomWallet(): Promise<SolanaWallet | null> {
  if (typeof window === "undefined") return null;
  const provider = (window as Window & { solana?: PhantomProvider }).solana;
  if (!provider?.isPhantom) return null;
  const response = await provider.connect();
  return {
    publicKey: response.publicKey,
    signTransaction: (tx) => provider.signTransaction(tx)
  };
}

// ── Account decoders ──────────────────────────────────────────────────────────

function decodeTaskState(address: PublicKey, data: Buffer): OnChainTaskState {
  let offset = 8;
  const taskId = data.readBigUInt64LE(offset); offset += 8;
  const requester = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const name = readBorshString(data, offset); offset = name.nextOffset;
  const taskType = readBorshString(data, offset); offset = taskType.nextOffset;
  const rewardPool = data.readBigUInt64LE(offset); offset += 8;
  const redundancyFactor = data.readUInt8(offset); offset += 1;
  const difficulty = data.readUInt8(offset); offset += 1;
  const verificationThreshold = data.readUInt8(offset); offset += 1;
  const executionTimeout = data.readBigUInt64LE(offset); offset += 8;
  const state = data.readUInt8(offset); offset += 1;
  const claimCount = data.readUInt32LE(offset); offset += 4;
  const canonicalResult = data.subarray(offset, offset + 32);

  return {
    taskId, requester, name: name.value, taskType: taskType.value,
    rewardPool, redundancyFactor, difficulty, verificationThreshold,
    executionTimeout, state, claimCount, canonicalResult, address
  };
}

function decodeClaim(address: PublicKey, data: Buffer): OnChainClaim {
  let offset = 8;
  const taskId = data.readBigUInt64LE(offset); offset += 8;
  const node = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const role = data.readUInt8(offset); offset += 1;
  const resultHash = data.subarray(offset, offset + 32); offset += 32;
  const confidence = data.readUInt8(offset); offset += 1;
  const challengeBond = data.readBigUInt64LE(offset); offset += 8;
  const reputationSettled = data.readUInt8(offset) !== 0;

  return { address, taskId, node, role, resultHash, confidence, challengeBond, reputationSettled };
}

function decodeNodeProfile(address: PublicKey, data: Buffer): OnChainNodeProfile {
  let offset = 8;
  const operator = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const hardwareHash = data.subarray(offset, offset + 32); offset += 32;
  const rolePreference = data.readUInt8(offset); offset += 1;
  const reputationScore = data.readUInt16LE(offset); offset += 2;
  const slashCount = data.readUInt16LE(offset); offset += 2;
  const challengeWins = data.readUInt16LE(offset); offset += 2;
  const totalTasks = data.readUInt32LE(offset);

  return { address, operator, hardwareHash, rolePreference, reputationScore, slashCount, challengeWins, totalTasks };
}

function decodeTaskHistory(address: PublicKey, data: Buffer): OnChainTaskHistory {
  let offset = 8;
  const owner = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const count = data.readUInt32LE(offset); offset += 4;
  const vecLen = data.readUInt32LE(offset); offset += 4;
  const recentTaskIds: bigint[] = [];
  for (let i = 0; i < vecLen; i++) {
    recentTaskIds.push(data.readBigUInt64LE(offset));
    offset += 8;
  }

  return { address, owner, count, recentTaskIds };
}

// ── Borsh / encoding utilities ────────────────────────────────────────────────

function readBorshString(data: Buffer, offset: number): { value: string; nextOffset: number } {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const value = data.subarray(start, start + length).toString("utf8");
  return { value, nextOffset: start + length };
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

// ── Transaction sending with retry ────────────────────────────────────────────

type BlockhashContext = { blockhash: string; lastValidBlockHeight: number };

function isBlockhashNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Blockhash not found") ||
    message.includes("blockhash not found") ||
    message.includes("BlockhashNotFound")
  );
}

async function applyFreshBlockhash(
  connection: Connection,
  transaction: Transaction,
  wallet: SolanaWallet
): Promise<BlockhashContext> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(RPC_COMMITMENT);
  transaction.feePayer = transaction.feePayer ?? wallet.publicKey;
  transaction.recentBlockhash = blockhash;
  transaction.signatures = [];
  return { blockhash, lastValidBlockHeight };
}

async function send(
  wallet: SolanaWallet,
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const blockhashContext = await applyFreshBlockhash(connection, transaction, wallet);
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: RPC_COMMITMENT
      });
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash: blockhashContext.blockhash, lastValidBlockHeight: blockhashContext.lastValidBlockHeight },
        RPC_COMMITMENT
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      return signature;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isBlockhashNotFoundError(error)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
