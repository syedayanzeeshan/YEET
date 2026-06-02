/**
 * @yeet-protocol/sdk
 *
 * Devnet client for the YEET correctness market protocol.
 * Program: 4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd
 *
 * Quick start:
 *   const { signature, taskId } = await createTask(wallet, {
 *     name: "sentiment-batch-v1",
 *     type: "inference",
 *     rewardPool: 3,          // × 0.001 SOL per unit
 *     redundancyFactor: 3,
 *     difficulty: 2,
 *     verificationThreshold: 75,
 *     executionTimeout: 30,
 *   });
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";

// ── Identity ──────────────────────────────────────────────────────────────────

export const YEET_PROGRAM_ID = new PublicKey(
  "4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd"
);

export const YEET_CLUSTER = "devnet" as const;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Lamports a challenger must bond when submitting a claim (0.005 SOL). */
export const CHALLENGE_BOND_LAMPORTS = BigInt(5_000_000);

// ── Instruction discriminators ────────────────────────────────────────────────

const IX_CREATE_TASK            = Buffer.from([194,  80,   6, 180, 232, 127,  48, 171]);
const IX_SUBMIT_CLAIM           = Buffer.from([163, 108, 111,  46, 220,  82,  77, 212]);
const IX_RESOLVE_TASK           = Buffer.from([116, 245, 180, 251,  30, 233, 101,  33]);
const IX_REGISTER_NODE          = Buffer.from([102,  85, 117, 114, 194, 188, 211, 168]);
const IX_UPDATE_NODE_REPUTATION = Buffer.from([120, 102, 142,  11, 103, 202, 252, 114]);

// ── Public types ──────────────────────────────────────────────────────────────

export type YeetWallet = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export type TaskInput = {
  name: string;
  type: string;
  rewardPool: number;
  redundancyFactor: number;
  difficulty: number;
  verificationThreshold: number;
  executionTimeout: number;
};

export type TaskState = {
  address: PublicKey;
  taskId: bigint;
  requester: PublicKey;
  name: string;
  taskType: string;
  rewardPool: bigint;
  redundancyFactor: number;
  difficulty: number;
  verificationThreshold: number;
  state: number;      // 0 = open, 1 = resolved
  claimCount: number;
  canonicalResult: Uint8Array;
};

export type Claim = {
  address: PublicKey;
  taskId: bigint;
  node: PublicKey;
  role: number;       // 0 = executor, 1 = validator, 2 = challenger
  resultHash: Uint8Array;
  confidence: number;
  challengeBond: bigint;
  reputationSettled: boolean;
};

export type NodeProfile = {
  address: PublicKey;
  operator: PublicKey;
  hardwareHash: Uint8Array;
  rolePreference: number;
  reputationScore: number;
  slashCount: number;
  challengeWins: number;
  totalTasks: number;
};

export type TaskHistory = {
  address: PublicKey;
  owner: PublicKey;
  count: number;
  recentTaskIds: bigint[];
};

// ── Connection ────────────────────────────────────────────────────────────────

export function getConnection(rpcUrl?: string): Connection {
  return new Connection(rpcUrl ?? clusterApiUrl(YEET_CLUSTER), "confirmed");
}

// ── PDA helpers ───────────────────────────────────────────────────────────────

export function protocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], YEET_PROGRAM_ID);
}

export function taskPda(taskId: bigint | number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync([Buffer.from("task"), buf], YEET_PROGRAM_ID);
}

export function claimPda(taskId: bigint | number, node: PublicKey): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(taskId));
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

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function fetchNextTaskId(connection?: Connection): Promise<bigint> {
  const conn = connection ?? getConnection();
  const [protocol] = protocolPda();
  const account = await conn.getAccountInfo(protocol);
  if (!account?.data || account.data.length < 17) return BigInt(0);
  return account.data.readBigUInt64LE(8);
}

export async function fetchTask(
  taskId: bigint | number,
  connection?: Connection
): Promise<TaskState | null> {
  const conn = connection ?? getConnection();
  const [address] = taskPda(taskId);
  const account = await conn.getAccountInfo(address);
  if (!account?.data) return null;
  return decodeTask(address, account.data);
}

export async function fetchClaims(
  taskId: bigint | number,
  connection?: Connection
): Promise<Claim[]> {
  const conn = connection ?? getConnection();
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(taskId));
  const { default: bs58 } = await import("bs58");
  const accounts = await conn.getProgramAccounts(YEET_PROGRAM_ID, {
    filters: [
      { dataSize: 92 },
      { memcmp: { offset: 8, bytes: bs58.encode(buf) } }
    ]
  });
  return accounts.flatMap(({ pubkey, account }) => {
    try { return [decodeClaim(pubkey, account.data)]; } catch { return []; }
  });
}

export async function fetchNodeProfile(
  operator: PublicKey,
  connection?: Connection
): Promise<NodeProfile | null> {
  const conn = connection ?? getConnection();
  const [address] = nodePda(operator);
  const account = await conn.getAccountInfo(address);
  if (!account?.data) return null;
  try { return decodeNodeProfile(address, account.data); } catch { return null; }
}

export async function fetchTaskHistory(
  requester: PublicKey,
  connection?: Connection
): Promise<TaskHistory | null> {
  const conn = connection ?? getConnection();
  const [address] = historyPda(requester);
  const account = await conn.getAccountInfo(address);
  if (!account?.data) return null;
  try { return decodeTaskHistory(address, account.data); } catch { return null; }
}

// ── Write instructions ────────────────────────────────────────────────────────

/**
 * Register this wallet as an on-chain node operator.
 * Safe to call multiple times — updates hardware hash and role preference.
 */
export async function registerNode(
  wallet: YeetWallet,
  hardwareLabel: string,
  rolePreference: 0 | 1 | 2 | 3 = 0,
  connection?: Connection
): Promise<{ signature: string; nodeProfileAddress: PublicKey }> {
  const conn = connection ?? getConnection();
  const [nodeProfile] = nodePda(wallet.publicKey);
  const hardwareHash = Buffer.alloc(32, 0);
  Buffer.from(hardwareLabel, "utf8").copy(
    hardwareHash, 0, 0,
    Math.min(32, Buffer.byteLength(hardwareLabel))
  );

  const ix = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: nodeProfile,      isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([IX_REGISTER_NODE, hardwareHash, Buffer.from([rolePreference])])
  });

  const sig = await sendTx(wallet, conn, new Transaction().add(ix));
  return { signature: sig, nodeProfileAddress: nodeProfile };
}

/**
 * Create an on-chain task and escrow the reward pool.
 * Returns the transaction signature and the assigned task ID.
 */
export async function createTask(
  wallet: YeetWallet,
  input: TaskInput,
  connection?: Connection
): Promise<{ signature: string; taskId: bigint; taskAddress: PublicKey }> {
  const conn = connection ?? getConnection();
  const name = (input.name.trim() || "Untitled task").slice(0, 64);
  const type = (input.type.trim() || "generic").slice(0, 32);
  const rewardLamports = BigInt(Math.max(1, Math.round(input.rewardPool * 1_000_000)));

  let nextId = await fetchNextTaskId(conn);
  const [protocol] = protocolPda();
  const [history]  = historyPda(wallet.publicKey);

  const buildIx = (id: bigint) => {
    const [tsa] = taskPda(id);
    return new TransactionInstruction({
      programId: YEET_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
        { pubkey: protocol,         isSigner: false, isWritable: true  },
        { pubkey: tsa,              isSigner: false, isWritable: true  },
        { pubkey: history,          isSigner: false, isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: Buffer.concat([
        IX_CREATE_TASK,
        u64le(id),
        borshStr(name),
        borshStr(type),
        u64le(rewardLamports),
        Buffer.from([
          Math.max(1, input.redundancyFactor),
          Math.max(1, input.difficulty),
          Math.max(1, Math.min(100, input.verificationThreshold))
        ]),
        u64le(BigInt(Math.max(1, input.executionTimeout)))
      ])
    });
  };

  try {
    const sig = await sendTx(wallet, conn, new Transaction().add(buildIx(nextId)));
    return { signature: sig, taskId: nextId, taskAddress: taskPda(nextId)[0] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("InvalidTaskId") || msg.includes("already in use")) {
      nextId = await fetchNextTaskId(conn);
      const sig = await sendTx(wallet, conn, new Transaction().add(buildIx(nextId)));
      return { signature: sig, taskId: nextId, taskAddress: taskPda(nextId)[0] };
    }
    throw err;
  }
}

/**
 * Submit an execution claim for an open task.
 * Challengers must have at least CHALLENGE_BOND_LAMPORTS available —
 * the bond is automatically bonded and returned on a winning challenge.
 */
export async function submitClaim(
  wallet: YeetWallet,
  taskId: bigint | number,
  role: "executor" | "validator" | "challenger",
  resultValue: string,
  confidence: number,
  connection?: Connection
): Promise<string> {
  const conn = connection ?? getConnection();
  const [taskState] = taskPda(taskId);
  const [claim]     = claimPda(taskId, wallet.publicKey);
  const roleByte    = role === "executor" ? 0 : role === "validator" ? 1 : 2;
  const hashBytes   = resultToBytes32(resultValue);

  const ix = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: taskState,        isSigner: false, isWritable: true  },
      { pubkey: claim,            isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([
      IX_SUBMIT_CLAIM,
      Buffer.from([roleByte]),
      Buffer.from(hashBytes),
      Buffer.from([Math.min(100, Math.max(0, confidence))])
    ])
  });

  return sendTx(wallet, conn, new Transaction().add(ix));
}

/**
 * Permissionlessly resolve a task once the minimum claim count is met.
 * Pass all Claim accounts and all node wallet accounts as `claims`.
 */
export async function resolveTask(
  wallet: YeetWallet,
  taskId: bigint | number,
  claims: Claim[],
  connection?: Connection
): Promise<string> {
  const conn = connection ?? getConnection();
  const [taskState] = taskPda(taskId);
  const uniqueNodes = Array.from(
    new Map(claims.map((c) => [c.node.toBase58(), c.node])).values()
  );

  const ix = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: taskState,        isSigner: false, isWritable: true  },
      ...claims.map((c)  => ({ pubkey: c.address, isSigner: false, isWritable: false })),
      ...uniqueNodes.map((n) => ({ pubkey: n,       isSigner: false, isWritable: true  }))
    ],
    data: IX_RESOLVE_TASK
  });

  return sendTx(wallet, conn, new Transaction().add(ix));
}

/**
 * Settle on-chain reputation for a registered node after task resolution.
 * Permissionless — any account can call this on behalf of a node.
 */
export async function updateNodeReputation(
  wallet: YeetWallet,
  taskId: bigint | number,
  nodePublicKey: PublicKey,
  connection?: Connection
): Promise<string> {
  const conn = connection ?? getConnection();
  const [taskState]   = taskPda(taskId);
  const [claim]       = claimPda(taskId, nodePublicKey);
  const [nodeProfile] = nodePda(nodePublicKey);

  const ix = new TransactionInstruction({
    programId: YEET_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: taskState,        isSigner: false, isWritable: false },
      { pubkey: claim,            isSigner: false, isWritable: true  },
      { pubkey: nodeProfile,      isSigner: false, isWritable: true  }
    ],
    data: IX_UPDATE_NODE_REPUTATION
  });

  return sendTx(wallet, conn, new Transaction().add(ix));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAccountUrl(address: PublicKey | string): string {
  return `https://explorer.solana.com/address/${address.toString()}?cluster=devnet`;
}

export function roleLabel(role: number): "executor" | "validator" | "challenger" | "unknown" {
  return (["executor", "validator", "challenger"] as const)[role] ?? "unknown";
}

export function canonicalHex(task: TaskState): string {
  return `0x${Buffer.from(task.canonicalResult).toString("hex")}`;
}

// ── Internal utilities ────────────────────────────────────────────────────────

function resultToBytes32(value: string): Uint8Array {
  const trimmed = value.trim();
  if (trimmed.startsWith("0x")) {
    const cleaned = trimmed.slice(2).replace(/[^0-9a-fA-F]/g, "").slice(0, 64);
    const bytes = Buffer.alloc(32, 0);
    Buffer.from(cleaned.padEnd(64, "0"), "hex").copy(bytes);
    return bytes;
  }
  const bytes = Buffer.alloc(32, 0);
  Buffer.from(trimmed, "utf8").copy(bytes, 0, 0, Math.min(32, Buffer.byteLength(trimmed)));
  return bytes;
}

function u64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

function borshStr(s: string): Buffer {
  const bytes = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

function readStr(data: Buffer, offset: number): { value: string; next: number } {
  const len = data.readUInt32LE(offset);
  const start = offset + 4;
  return { value: data.subarray(start, start + len).toString("utf8"), next: start + len };
}

function decodeTask(address: PublicKey, data: Buffer): TaskState {
  let o = 8;
  const taskId = data.readBigUInt64LE(o); o += 8;
  const requester = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const { value: name, next: o2 } = readStr(data, o); o = o2;
  const { value: taskType, next: o3 } = readStr(data, o); o = o3;
  const rewardPool = data.readBigUInt64LE(o); o += 8;
  const redundancyFactor = data.readUInt8(o); o++;
  const difficulty = data.readUInt8(o); o++;
  const verificationThreshold = data.readUInt8(o); o++;
  o += 8; // executionTimeout
  const state = data.readUInt8(o); o++;
  const claimCount = data.readUInt32LE(o); o += 4;
  const canonicalResult = data.subarray(o, o + 32);
  return { address, taskId, requester, name, taskType, rewardPool, redundancyFactor, difficulty, verificationThreshold, state, claimCount, canonicalResult };
}

function decodeClaim(address: PublicKey, data: Buffer): Claim {
  let o = 8;
  const taskId = data.readBigUInt64LE(o); o += 8;
  const node = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const role = data.readUInt8(o); o++;
  const resultHash = data.subarray(o, o + 32); o += 32;
  const confidence = data.readUInt8(o); o++;
  const challengeBond = data.readBigUInt64LE(o); o += 8;
  const reputationSettled = data.readUInt8(o) !== 0;
  return { address, taskId, node, role, resultHash, confidence, challengeBond, reputationSettled };
}

function decodeNodeProfile(address: PublicKey, data: Buffer): NodeProfile {
  let o = 8;
  const operator = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const hardwareHash = data.subarray(o, o + 32); o += 32;
  const rolePreference = data.readUInt8(o); o++;
  const reputationScore = data.readUInt16LE(o); o += 2;
  const slashCount = data.readUInt16LE(o); o += 2;
  const challengeWins = data.readUInt16LE(o); o += 2;
  const totalTasks = data.readUInt32LE(o);
  return { address, operator, hardwareHash, rolePreference, reputationScore, slashCount, challengeWins, totalTasks };
}

function decodeTaskHistory(address: PublicKey, data: Buffer): TaskHistory {
  let o = 8;
  const owner = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const count = data.readUInt32LE(o); o += 4;
  const vecLen = data.readUInt32LE(o); o += 4;
  const recentTaskIds: bigint[] = [];
  for (let i = 0; i < vecLen; i++) { recentTaskIds.push(data.readBigUInt64LE(o)); o += 8; }
  return { address, owner, count, recentTaskIds };
}

async function sendTx(
  wallet: YeetWallet,
  conn: Connection,
  tx: Transaction
): Promise<string> {
  tx.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.signatures = [];
  const signed = await wallet.signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  const result = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  return sig;
}
