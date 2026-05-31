"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import type { YeetTaskInput } from "@/app/types/yeet";
import {
  buildSubmitClaimTransaction,
  bytesToDigestHex,
  claimPda,
  claimSignPageUrl,
  explorerTxUrl,
  loadActiveTaskId,
  parseNodePubkey,
  roleLabel,
  serializeTransaction,
  storeActiveTaskId,
  type OnChainClaim,
  type OnChainTaskState
} from "@/app/lib/solana/yeetProgram";

type Props = {
  task: YeetTaskInput;
  activeTaskId: string | null;
  claims: OnChainClaim[];
  taskState: OnChainTaskState | null;
  lastTxSignature: string | null;
  connectedWallet?: string | null;
  onSignAndSend: (
    nodeAddress: string,
    role: "executor" | "validator" | "challenger",
    resultValue: string,
    confidence: number,
    taskIdOverride: string
  ) => Promise<unknown>;
  onResolve: (taskId: string) => Promise<unknown>;
  onRefresh: () => void;
  onTaskIdChange?: (taskId: string) => void;
};

function resolvePanelTaskId(activeTaskId: string | null, taskIdInput: string): string | null {
  if (activeTaskId !== null) return activeTaskId;
  const trimmed = taskIdInput.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

export function LiveClaimPanel({
  task,
  activeTaskId,
  claims,
  taskState,
  lastTxSignature,
  connectedWallet,
  onSignAndSend,
  onResolve,
  onRefresh,
  onTaskIdChange
}: Props) {
  const [taskIdInput, setTaskIdInput] = useState(() => activeTaskId ?? "0");
  const [nodeAddress, setNodeAddress] = useState("");
  const [role, setRole] = useState<"executor" | "validator" | "challenger">("executor");
  const [resultValue, setResultValue] = useState("correct-result-v1");
  const [confidence, setConfidence] = useState(85);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [preparedTx, setPreparedTx] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTaskId !== null) {
      queueMicrotask(() => setTaskIdInput(activeTaskId));
      return;
    }
    queueMicrotask(() => {
      const stored = loadActiveTaskId();
      if (stored !== null && stored !== "") setTaskIdInput(stored);
    });
  }, [activeTaskId]);

  useEffect(() => {
    if (connectedWallet) {
      queueMicrotask(() => setNodeAddress((current) => current || connectedWallet));
    }
  }, [connectedWallet]);

  const nodePubkey = useMemo(() => parseNodePubkey(nodeAddress), [nodeAddress]);

  const parsedTaskId = useMemo(() => {
    const trimmed = taskIdInput.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }, [taskIdInput]);

  const claimAddress = useMemo(() => {
    if (!nodePubkey || parsedTaskId === null) return null;
    return claimPda(parsedTaskId, nodePubkey)[0].toBase58();
  }, [nodePubkey, parsedTaskId]);

  const walletMatches = Boolean(
    nodePubkey && connectedWallet && nodePubkey.toBase58() === connectedWallet
  );

  const minClaims = Math.max(1, task.difficulty);
  const claimCount = taskState?.claimCount ?? claims.length;
  const canResolve = claimCount >= minClaims && (taskState?.state ?? 0) === 0;
  const isResolved = (taskState?.state ?? 0) === 1;
  const displayedTaskId = resolvePanelTaskId(activeTaskId, taskIdInput);

  async function prepareClaimTx() {
    if (!nodePubkey || parsedTaskId === null) return null;
    return buildSubmitClaimTransaction(nodePubkey, parsedTaskId, role, resultValue, confidence);
  }

  async function copyTxForOtherDevice() {
    const transaction = await prepareClaimTx();
    if (!transaction) return;
    const encoded = serializeTransaction(transaction);
    setPreparedTx(encoded);
    await navigator.clipboard.writeText(encoded);
    setCopyStatus("Transaction copied — paste on /claim/sign on the other device.");
  }

  async function copySignLinkSameBrowser() {
    const transaction = await prepareClaimTx();
    if (!transaction) return;
    const encoded = serializeTransaction(transaction);
    const url = claimSignPageUrl(encoded);
    setPreparedTx(encoded);
    setPreparedUrl(url);
    await navigator.clipboard.writeText(url);
    setCopyStatus("Sign link copied (works in this browser only).");
  }

  function saveTaskId() {
    if (parsedTaskId === null) return;
    storeActiveTaskId(parsedTaskId);
    onTaskIdChange?.(taskIdInput.trim());
    onRefresh();
    setCopyStatus(`Task id ${parsedTaskId.toString()} saved.`);
  }

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">On-chain Claims</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[10px] uppercase tracking-[0.16em] text-pulse hover:text-white"
        >
          refresh
        </button>
      </div>

      {displayedTaskId !== null ? (
        <div className="mb-4 border border-acid/30 bg-acid/[0.08] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Active on-chain task</div>
          <div className="mt-1 font-mono text-xl font-black text-acid">#{displayedTaskId}</div>
        </div>
      ) : null}

      <label className="mb-4 grid gap-1 text-xs text-white/60">
        Task id (override or enter manually)
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-pulse"
            value={taskIdInput}
            onChange={(event) => setTaskIdInput(event.target.value)}
            placeholder="0"
          />
          <button
            type="button"
            onClick={saveTaskId}
            className="border border-white/15 px-2 text-[10px] uppercase text-white/55"
          >
            Save
          </button>
        </div>
        {activeTaskId === null ? (
          <span className="text-[10px] text-amber">
            No task from this session yet — enter the id from your create_task tx, then Save.
          </span>
        ) : null}
      </label>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Claims" value={`${claimCount} / ${minClaims}`} tone={canResolve ? "acid" : "pulse"} />
        <Stat label="Status" value={isResolved ? "resolved" : "open"} tone={isResolved ? "acid" : "pulse"} />
        <Stat label="Task" value={parsedTaskId !== null ? parsedTaskId.toString() : "—"} />
      </div>

      {lastTxSignature ? (
        <a
          href={explorerTxUrl(lastTxSignature)}
          target="_blank"
          rel="noreferrer"
          className="mb-4 flex items-center gap-2 truncate border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-acid hover:border-acid/30"
        >
          <ExternalLink size={12} />
          <span className="truncate">{lastTxSignature}</span>
        </a>
      ) : null}

      {copyStatus ? <p className="mb-3 text-[10px] text-acid">{copyStatus}</p> : null}

      <div className="space-y-3 border-b border-white/10 pb-4">
        <p className="text-xs leading-5 text-white/50">
          Enter the node wallet that signs the claim (can be the same wallet that created the task). Set difficulty to
          1 for a one-claim demo.
        </p>

        <label className="grid gap-1 text-xs text-white/60">
          Node wallet address
          <input
            className="border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-pulse"
            placeholder="Your Phantom address on devnet"
            value={nodeAddress}
            onChange={(event) => setNodeAddress(event.target.value)}
          />
        </label>

        {connectedWallet ? (
          <button
            type="button"
            onClick={() => setNodeAddress(connectedWallet)}
            className="text-[10px] uppercase tracking-[0.14em] text-pulse hover:text-white"
          >
            Use connected wallet ({connectedWallet.slice(0, 8)}…)
          </button>
        ) : null}

        {claimAddress ? (
          <div className="text-[10px] text-white/40">
            Claim PDA: <span className="font-mono text-white/60">{claimAddress.slice(0, 16)}…</span>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-1">
          {(["executor", "validator", "challenger"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRole(option)}
              className={`border px-2 py-1 text-[10px] uppercase ${
                role === option ? "border-acid/40 bg-acid/15 text-acid" : "border-white/10 text-white/45"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="grid gap-1 text-xs text-white/60">
          Dummy result (text or 0x hex)
          <input
            className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-pulse"
            value={resultValue}
            onChange={(event) => setResultValue(event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-xs text-white/60">
          Confidence: {confidence}%
          <input
            type="range"
            min={1}
            max={100}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            className="accent-pulse"
          />
        </label>

        <div className="grid gap-2">
          <button
            type="button"
            disabled={!nodePubkey || parsedTaskId === null || isResolved}
            onClick={() => void copyTxForOtherDevice()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 border border-pulse/35 bg-pulse/15 text-[10px] font-bold uppercase tracking-[0.16em] text-pulse disabled:opacity-40"
          >
            <Copy size={14} />
            Copy tx for other device
          </button>

          <button
            type="button"
            disabled={!nodePubkey || parsedTaskId === null || isResolved}
            onClick={() => void copySignLinkSameBrowser()}
            className="inline-flex h-9 w-full items-center justify-center gap-2 border border-white/15 text-[10px] uppercase tracking-[0.14em] text-white/60 disabled:opacity-40"
          >
            <Copy size={12} />
            Copy sign link (same browser)
          </button>

          {preparedUrl ? (
            <a
              href={preparedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-full items-center justify-center gap-2 border border-white/15 text-[10px] uppercase tracking-[0.14em] text-white/60"
            >
              <ExternalLink size={12} />
              Open sign page
            </a>
          ) : null}

          {walletMatches ? (
            <button
              type="button"
              disabled={submitting || isResolved || !nodePubkey || parsedTaskId === null}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onSignAndSend(nodeAddress, role, resultValue, confidence, taskIdInput);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 border border-acid/35 bg-acid/15 text-[10px] font-bold uppercase tracking-[0.16em] text-acid disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Sign here (wallet matches)
            </button>
          ) : (
            <p className="text-[10px] text-white/40">
              To sign on this machine, connect Phantom as the node address above. For another device, use Copy tx +
              paste on /claim/sign.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Resolve</div>
        <button
          type="button"
          disabled={!canResolve || isResolved || parsedTaskId === null}
          onClick={() => void onResolve(taskIdInput)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 border border-acid/35 bg-acid/15 text-[10px] font-bold uppercase tracking-[0.16em] text-acid disabled:opacity-40"
        >
          <CheckCircle2 size={14} />
          Resolve on-chain
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Submitted claims</div>
        <div className="thin-scrollbar grid max-h-[160px] gap-1 overflow-auto">
          {claims.length === 0 ? (
            <div className="border border-white/10 bg-black/20 p-2 text-xs text-white/40">No claims yet.</div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.address.toBase58()}
                className="grid gap-0.5 border border-white/10 bg-black/20 px-2 py-1.5 text-[10px]"
              >
                <div className="flex justify-between text-white/70">
                  <span>{roleLabel(claim.role)}</span>
                  <span className={claim.confidence < task.verificationThreshold ? "text-flare" : "text-white/55"}>
                    {claim.confidence}%
                  </span>
                </div>
                <div className="truncate font-mono text-white/45">{claim.node.toBase58()}</div>
                <div className="truncate text-acid">{bytesToDigestHex(claim.resultHash)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {isResolved && taskState ? (
        <div className="mt-3 border border-acid/25 bg-acid/[0.06] p-3 text-xs">
          <div className="text-[10px] uppercase text-white/45">Canonical result</div>
          <div className="mt-1 break-all font-mono text-acid">{bytesToDigestHex(taskState.canonicalResult)}</div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "pulse"
}: {
  label: string;
  value: string;
  tone?: "pulse" | "acid";
}) {
  return (
    <div className="border border-white/10 bg-black/20 p-2">
      <div className="text-[9px] uppercase text-white/40">{label}</div>
      <div className={`mt-1 font-bold ${tone === "acid" ? "text-acid" : "text-pulse"}`}>{value}</div>
    </div>
  );
}
