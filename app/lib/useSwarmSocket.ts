"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConsensusRound,
  ExecutionReceipt,
  MarketplaceTask,
  NodeReputation,
  SwarmLogEvent,
  SwarmMetrics,
  SwarmSocketSnapshot,
  YeetNode,
  YeetTaskInput
} from "@/app/types/yeet";
import {
  canonicalResultHex,
  connectPhantomWallet,
  createTask,
  fetchClaimsForTask,
  fetchTaskState,
  isLiveProgramConfigured,
  resolveTask,
  clearActiveTaskId,
  loadActiveTaskId,
  parseNodePubkey,
  storeActiveTaskId,
  submitClaim,
  type OnChainClaim,
  type OnChainTaskState,
  type SolanaWallet
} from "@/app/lib/solana/yeetProgram";

const emptyMetrics: SwarmMetrics = {
  connectedNodes: 0,
  heartbeatsPerMinute: 0,
  receiptsVerified: 0,
  invalidReceipts: 0,
  queuedTasks: 0,
  activeTasks: 0,
  completedTasks: 0,
  slashedNodes: 0
};

const emptySnapshot: SwarmSocketSnapshot = {
  connected: false,
  nodes: [],
  assignedNodeIds: [],
  receipts: [],
  reputation: [],
  tasks: [],
  logs: [],
  metrics: emptyMetrics
};

const LIVE_HISTORY_STORAGE_KEY = "yeet_live_dashboard_history";

type ServerMessage =
  | { type: "snapshot"; payload: Partial<SwarmSocketSnapshot> }
  | { type: "round"; payload: ConsensusRound }
  | { type: "nodes"; payload: YeetNode[] }
  | { type: "tasks"; payload: MarketplaceTask[] }
  | { type: "metrics"; payload: Partial<SwarmMetrics> }
  | { type: "log"; payload: SwarmLogEvent };

export type SwarmSocketOptions = {
  liveMode?: boolean;
  wallet?: SolanaWallet | null;
  task?: YeetTaskInput;
  onWalletConnected?: (wallet: SolanaWallet) => void;
};

const defaultWs =
  process.env.NEXT_PUBLIC_YEET_COORDINATOR_WS ?? "ws://localhost:8787";

function makeLog(
  level: SwarmLogEvent["level"],
  message: string
): SwarmLogEvent {
  return {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ts: Date.now(),
    level,
    message
  };
}

export function useSwarmSocket(url: string = defaultWs, options: SwarmSocketOptions = {}) {
  const { liveMode = false, wallet = null, task, onWalletConnected } = options;
  const socketRef = useRef<WebSocket | null>(null);
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const [activeTaskId, setActiveTaskId] = useState<bigint | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
  const [onChainResult, setOnChainResult] = useState<string | null>(null);
  const [onChainClaims, setOnChainClaims] = useState<OnChainClaim[]>([]);
  const [onChainTaskState, setOnChainTaskState] = useState<OnChainTaskState | null>(null);

  const [snapshot, setSnapshot] = useState<SwarmSocketSnapshot>(emptySnapshot);

  const appendLog = useCallback((log: SwarmLogEvent) => {
    setSnapshot((current) => ({
      ...current,
      logs: [log, ...current.logs].slice(0, 42)
    }));
  }, []);

  useEffect(() => {
    const stored = loadActiveTaskId();
    if (stored !== null && stored !== "") {
      queueMicrotask(() => setActiveTaskId(BigInt(stored)));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const persisted = loadLiveHistory();
      if (!persisted) return;
      setSnapshot((current) => mergeSnapshots(current, persisted));
    });
  }, []);

  useEffect(() => {
    if (liveMode) return;

    let cancelled = false;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, connected: true }));
    };

    socket.onclose = () => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, connected: false }));
    };

    socket.onerror = () => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, connected: false }));
    };

    socket.onmessage = (event: MessageEvent) => {
      if (cancelled) return;
      const parsed = parseMessage(event.data);
      if (!parsed) return;
      setSnapshot((current) => reduceMessage(current, parsed));
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [url, liveMode]);

  const refreshOnChainState = useCallback(async (taskId?: bigint | null, includeClaims = false, force = false) => {
    const id = taskId ?? activeTaskId;
    if (id === null || !isLiveProgramConfigured()) return;

    const now = Date.now();
    if (!force && (refreshInFlightRef.current || now - lastRefreshAtRef.current < 5000)) return;

    refreshInFlightRef.current = true;
    lastRefreshAtRef.current = now;
    try {
      const taskState = await fetchTaskState(id);
      setOnChainTaskState(taskState);
      if (taskState?.state === 1) {
        setOnChainResult(canonicalResultHex(taskState));
      }

      if (includeClaims) {
        const claims = await fetchClaimsForTask(id);
        setOnChainClaims(claims);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429") || message.toLowerCase().includes("too many requests")) {
        lastRefreshAtRef.current = now + 30_000;
        appendLog(makeLog("warn", "Solana RPC rate limited — refresh paused for 30s."));
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [activeTaskId, appendLog]);

  useEffect(() => {
    if (!liveMode || activeTaskId === null) return;
    const refresh = () => void refreshOnChainState(activeTaskId, true);
    queueMicrotask(refresh);
    const timer = window.setInterval(() => {
      void refreshOnChainState(activeTaskId, false);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [liveMode, activeTaskId, refreshOnChainState]);

  useEffect(() => {
    if (!liveMode) return;
    queueMicrotask(() => {
      setSnapshot((current) => ({
        ...current,
        connected: Boolean(wallet?.publicKey) && isLiveProgramConfigured()
      }));
    });
  }, [liveMode, wallet]);

  useEffect(() => {
    if (!liveMode) return;

    queueMicrotask(() => {
      setSnapshot((current) => {
        const liveSnapshot = buildLiveSnapshot({
          current,
          task,
          activeTaskId,
          taskState: onChainTaskState,
          claims: onChainClaims,
          walletAddress: wallet?.publicKey.toBase58() ?? null,
          lastTxSignature
        });

        storeLiveHistory(liveSnapshot);
        return liveSnapshot;
      });
    });
  }, [liveMode, task, activeTaskId, onChainTaskState, onChainClaims, wallet, lastTxSignature]);

  const ensureWallet = useCallback(async (): Promise<SolanaWallet | null> => {
    if (wallet) return wallet;
    const connected = await connectPhantomWallet();
    if (connected) {
      onWalletConnected?.(connected);
    }
    return connected;
  }, [wallet, onWalletConnected]);

  const dispatchTask = useCallback(
    async (task: YeetTaskInput): Promise<boolean | string> => {
      if (liveMode && isLiveProgramConfigured()) {
        const signer = await ensureWallet();
        if (!signer) {
          appendLog(makeLog("warn", "Connect Phantom wallet for on-chain task creation."));
          return false;
        }

        try {
          const result = await createTask(signer, task);
          setActiveTaskId(result.taskId);
          storeActiveTaskId(result.taskId);
          setLastTxSignature(result.signature);
          setOnChainClaims([]);
          setOnChainTaskState(null);
          setOnChainResult(null);
          await refreshOnChainState(result.taskId, true, true);
          appendLog(
            makeLog(
              "success",
              `On-chain task #${result.taskId} created — tx ${result.signature.slice(0, 16)}…`
            )
          );
          setSnapshot((current) => ({
            ...current,
            connected: true,
            metrics: {
              ...current.metrics,
              queuedTasks: current.metrics.queuedTasks + 1,
              activeTasks: current.metrics.activeTasks + 1
            },
            tasks: [
              {
                id: result.taskId.toString(),
                name: task.name,
                type: task.type,
                status: "active",
                rewardPool: task.rewardPool,
                participantIds: [signer.publicKey.toBase58()],
                createdAt: Date.now(),
                updatedAt: Date.now()
              },
              ...current.tasks
            ]
          }));
          return result.signature;
        } catch (error) {
          const message = error instanceof Error ? error.message : "create_task failed";
          appendLog(makeLog("danger", message));
          return false;
        }
      }

      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;

      socket.send(JSON.stringify({ type: "dispatch_task", payload: task }));
      return true;
    },
    [liveMode, ensureWallet, appendLog, refreshOnChainState]
  );

  const submitClaimForNode = useCallback(
    async (
      nodeAddress: string,
      role: "executor" | "validator" | "challenger",
      resultValue: string,
      confidence: number,
      taskIdOverride?: string | bigint
    ): Promise<string | false> => {
      if (!liveMode || !isLiveProgramConfigured()) return false;

      const node = parseNodePubkey(nodeAddress);
      if (!node) {
        appendLog(makeLog("warn", "Enter a valid Solana wallet address."));
        return false;
      }

      const signer = await ensureWallet();
      if (!signer) {
        appendLog(makeLog("warn", "Connect Phantom to sign the claim."));
        return false;
      }

      if (signer.publicKey.toBase58() !== node.toBase58()) {
        appendLog(
          makeLog(
            "warn",
            "Connected Phantom must match the node address. Use the sign link on the other device instead."
          )
        );
        return false;
      }

      const id =
        taskIdOverride !== undefined && taskIdOverride !== ""
          ? typeof taskIdOverride === "bigint"
            ? taskIdOverride
            : BigInt(taskIdOverride)
          : activeTaskId;
      if (id === null) {
        appendLog(makeLog("warn", "No active on-chain task id for submit_claim."));
        return false;
      }

      try {
        const signature = await submitClaim(signer, id, role, resultValue, confidence);
        setLastTxSignature(signature);
        appendLog(makeLog("success", `Claim submitted on-chain — tx ${signature.slice(0, 16)}…`));
        await refreshOnChainState(id, true, true);
        return signature;
      } catch (error) {
        const message = error instanceof Error ? error.message : "submit_claim failed";
        appendLog(makeLog("danger", message));
        return false;
      }
    },
    [liveMode, activeTaskId, ensureWallet, appendLog, refreshOnChainState]
  );

  const resolveOnChain = useCallback(
    async (taskId?: bigint): Promise<string | false> => {
      if (!liveMode || !isLiveProgramConfigured()) return false;

      const signer = await ensureWallet();
      if (!signer) return false;

      const id = taskId ?? activeTaskId;
      if (id === null) return false;

      try {
        const claims = await fetchClaimsForTask(id);
        const signature = await resolveTask(signer, id, claims);
        setLastTxSignature(signature);

        const taskState = await fetchTaskState(id);
        if (taskState?.state === 1) {
          const canonical = canonicalResultHex(taskState);
          setOnChainResult(canonical);
          appendLog(
            makeLog("success", `Task resolved on-chain — canonical ${canonical.slice(0, 18)}…`)
          );
        }

        await refreshOnChainState(id, true, true);
        return signature;
      } catch (error) {
        const message = error instanceof Error ? error.message : "resolve_task failed";
        appendLog(makeLog("danger", message));
        return false;
      }
    },
    [liveMode, activeTaskId, ensureWallet, appendLog, refreshOnChainState]
  );

  const armMaliciousWorker = useCallback(async () => {
    if (liveMode && activeTaskId !== null && wallet) {
      const result = await submitClaimForNode(
        wallet.publicKey.toBase58(),
        "executor",
        "fraudulent-result",
        38
      );
      return Boolean(result);
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "inject_malicious_worker" }));
    return true;
  }, [liveMode, activeTaskId, wallet, submitClaimForNode]);

  const resetDemo = useCallback(() => {
    if (liveMode) {
      setActiveTaskId(null);
      clearActiveTaskId();
      setOnChainResult(null);
      setLastTxSignature(null);
      setOnChainClaims([]);
      setOnChainTaskState(null);
      appendLog(makeLog("info", "Live mode state cleared locally."));
      return true;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "reset_demo" }));
    return true;
  }, [liveMode, appendLog]);

  const selectActiveTaskId = useCallback((taskId: bigint | null) => {
    setActiveTaskId(taskId);
    if (taskId !== null) {
      storeActiveTaskId(taskId);
    } else {
      clearActiveTaskId();
    }
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      liveMode,
      activeTaskId,
      lastTxSignature,
      onChainResult,
      onChainClaims,
      onChainTaskState,
      dispatchTask,
      submitClaimForNode,
      refreshOnChainState,
      resolveOnChain,
      armMaliciousWorker,
      resetDemo,
      selectActiveTaskId
    }),
    [
      snapshot,
      liveMode,
      activeTaskId,
      lastTxSignature,
      onChainResult,
      onChainClaims,
      onChainTaskState,
      dispatchTask,
      submitClaimForNode,
      refreshOnChainState,
      resolveOnChain,
      armMaliciousWorker,
      resetDemo,
      selectActiveTaskId
    ]
  );
}

function mergeMetrics(
  current: SwarmMetrics,
  partial: Partial<SwarmMetrics> | undefined
): SwarmMetrics {
  if (!partial) return current;
  return { ...current, ...partial };
}

function reduceMessage(
  current: SwarmSocketSnapshot,
  message: ServerMessage
): SwarmSocketSnapshot {
  switch (message.type) {
    case "snapshot":
      return {
        ...current,
        ...message.payload,
        connected: true,
        metrics: mergeMetrics(current.metrics, message.payload.metrics)
      };

    case "round":
      return {
        ...current,
        currentRound: message.payload
      };

    case "nodes":
      return {
        ...current,
        nodes: message.payload
      };

    case "tasks":
      return {
        ...current,
        tasks: message.payload
      };

    case "metrics":
      return {
        ...current,
        metrics: mergeMetrics(current.metrics, message.payload)
      };

    case "log":
      return {
        ...current,
        logs: [message.payload, ...current.logs].slice(0, 42)
      };

    default:
      return current;
  }
}

function buildLiveSnapshot({
  current,
  task,
  activeTaskId,
  taskState,
  claims,
  walletAddress,
  lastTxSignature
}: {
  current: SwarmSocketSnapshot;
  task?: YeetTaskInput;
  activeTaskId: bigint | null;
  taskState: OnChainTaskState | null;
  claims: OnChainClaim[];
  walletAddress: string | null;
  lastTxSignature: string | null;
}): SwarmSocketSnapshot {
  const taskId = taskState?.taskId ?? activeTaskId;
  const taskIdText = taskId?.toString() ?? null;
  const isResolved = taskState?.state === 1;
  const hasTask = taskIdText !== null;
  const taskName = taskState?.name ?? task?.name ?? "Live on-chain task";
  const taskType = (taskState?.taskType ?? task?.type ?? "matrix") as YeetTaskInput["type"];
  const rewardPool =
    taskState !== null ? Number(taskState.rewardPool) / 1_000_000 : task?.rewardPool ?? 0;
  const participantIds = Array.from(
    new Set([
      ...(walletAddress ? [walletAddress] : []),
      ...claims.map((claim) => claim.node.toBase58())
    ])
  );
  const receipts = mergeById(
    buildLiveReceipts(claims, taskIdText, lastTxSignature, current.receipts),
    current.receipts,
    (receipt) => receipt.receiptId
  );
  const reputation = mergeById(
    buildLiveReputation(claims, taskState),
    current.reputation,
    (entry) => entry.nodeId
  );

  const tasks: MarketplaceTask[] = hasTask
    ? [
        {
          id: taskIdText,
          name: taskName,
          type: taskType,
          status: isResolved ? "completed" : claims.length > 0 ? "active" : "queued",
          rewardPool,
          participantIds,
          createdAt: current.tasks.find((entry) => entry.id === taskIdText)?.createdAt ?? Date.now(),
          updatedAt: Date.now()
        },
        ...current.tasks.filter((entry) => entry.id !== taskIdText)
      ]
    : current.tasks;

  const queuedTasks = tasks.filter((entry) => entry.status === "queued").length;
  const activeTasks = tasks.filter((entry) => entry.status === "active").length;
  const completedTasks = tasks.filter((entry) => entry.status === "completed").length;
  const invalidReceipts =
    taskState?.state === 1
      ? claims.filter((claim) => !bytesEqual(claim.resultHash, taskState.canonicalResult)).length
      : 0;
  const slashedNodes =
    taskState?.state === 1
      ? claims.filter(
          (claim) =>
            !bytesEqual(claim.resultHash, taskState.canonicalResult) ||
            claim.confidence < taskState.verificationThreshold
        ).length
      : 0;

  return {
    ...current,
    connected: Boolean(walletAddress) && isLiveProgramConfigured(),
    receipts,
    reputation,
    tasks,
    metrics: {
      connectedNodes: Math.max(participantIds.length, walletAddress ? 1 : 0),
      heartbeatsPerMinute: hasTask ? Math.max(12, participantIds.length * 18) : 0,
      receiptsVerified: claims.length - invalidReceipts,
      invalidReceipts,
      queuedTasks,
      activeTasks,
      completedTasks,
      slashedNodes
    }
  };
}

function buildLiveReceipts(
  claims: OnChainClaim[],
  taskId: string | null,
  lastTxSignature: string | null,
  existingReceipts: ExecutionReceipt[]
): ExecutionReceipt[] {
  if (taskId === null) return [];

  return claims.map((claim, index) => {
    const node = claim.node.toBase58();
    const digest = bytesToHex(claim.resultHash);
    const receiptId = claim.address.toBase58();
    const existing = existingReceipts.find((receipt) => receipt.receiptId === receiptId);
    return {
      receiptId,
      taskId,
      nodeId: node,
      digest,
      role: claim.role === 0 ? "executor" : claim.role === 1 ? "validator" : "challenger",
      issuedAt: existing?.issuedAt ?? Date.now() - (claims.length - index) * 1500,
      publicKey: node,
      signature: lastTxSignature ?? existing?.signature ?? receiptId,
      verified: true
    };
  });
}

function buildLiveReputation(
  claims: OnChainClaim[],
  taskState: OnChainTaskState | null
): NodeReputation[] {
  const canonical = taskState?.state === 1 ? taskState.canonicalResult : null;

  return claims.map((claim) => {
    const matchesCanonical = canonical === null || bytesEqual(claim.resultHash, canonical);
    const confident = taskState === null || claim.confidence >= taskState.verificationThreshold;
    const penalized = !matchesCanonical || !confident;

    return {
      nodeId: claim.node.toBase58(),
      reputationScore: penalized ? Math.max(0, claim.confidence - 20) : Math.min(100, 70 + Math.round(claim.confidence / 4)),
      slashCount: penalized ? 1 : 0,
      successfulValidations: penalized ? 0 : 1,
      challengeWins: claim.role === 2 && !penalized ? 1 : 0,
      maliciousFlags: penalized ? 1 : 0,
      lastSeen: Date.now()
    };
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function mergeById<T>(primary: T[], secondary: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const value of [...primary, ...secondary]) {
    const key = keyFor(value);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}

function mergeSnapshots(current: SwarmSocketSnapshot, persisted: Partial<SwarmSocketSnapshot>): SwarmSocketSnapshot {
  const tasks = mergeById(persisted.tasks ?? [], current.tasks, (task) => task.id);
  const receipts = mergeById(persisted.receipts ?? [], current.receipts, (receipt) => receipt.receiptId);
  const reputation = mergeById(persisted.reputation ?? [], current.reputation, (entry) => entry.nodeId);
  const logs = mergeById(persisted.logs ?? [], current.logs, (log) => log.id).slice(0, 42);

  return {
    ...current,
    tasks,
    receipts,
    reputation,
    logs,
    metrics: {
      ...current.metrics,
      queuedTasks: tasks.filter((task) => task.status === "queued").length,
      activeTasks: tasks.filter((task) => task.status === "active").length,
      completedTasks: tasks.filter((task) => task.status === "completed").length,
      receiptsVerified: receipts.filter((receipt) => receipt.verified).length,
      invalidReceipts: receipts.filter((receipt) => !receipt.verified).length,
      connectedNodes: Math.max(current.metrics.connectedNodes, reputation.length)
    }
  };
}

function loadLiveHistory(): Partial<SwarmSocketSnapshot> | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LIVE_HISTORY_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<SwarmSocketSnapshot>;
  } catch {
    return null;
  }
}

function storeLiveHistory(snapshot: SwarmSocketSnapshot): void {
  if (typeof window === "undefined") return;

  const payload: Partial<SwarmSocketSnapshot> = {
    tasks: snapshot.tasks.slice(0, 12),
    receipts: snapshot.receipts.slice(0, 24),
    reputation: snapshot.reputation.slice(0, 12),
    logs: snapshot.logs.slice(0, 42),
    metrics: snapshot.metrics
  };

  localStorage.setItem(LIVE_HISTORY_STORAGE_KEY, JSON.stringify(payload));
}

function parseMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;

  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    return null;
  }
}
