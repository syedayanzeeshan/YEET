"use client";

import { useEffect, useState } from "react";
import { Copy, SendHorizontal } from "lucide-react";
import { YeetTaskInput, TaskType } from "@/app/types/yeet";
import { taskLabels } from "@/app/lib/yeetSimulation";
import { isLiveProgramConfigured, loadActiveTaskId } from "@/app/lib/solana/yeetProgram";

type Props = {
  task: YeetTaskInput;
  setTask: (task: YeetTaskInput) => void;
  onYeet: () => void;
  liveMode: boolean;
  setLiveMode: (live: boolean) => void;
  onConnectWallet?: () => void;
  walletConnected?: boolean;
  activeTaskId?: string | null;
  lastTxSignature?: string | null;
};

export function TaskSubmissionPanel({
  task,
  setTask,
  onYeet,
  liveMode,
  setLiveMode,
  onConnectWallet,
  walletConnected,
  activeTaskId,
  lastTxSignature
}: Props) {
  const [storedTaskId, setStoredTaskId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setStoredTaskId(loadActiveTaskId()));
  }, [activeTaskId]);

  const displayedTaskId = activeTaskId ?? storedTaskId;

  const update = <K extends keyof YeetTaskInput>(key: K, value: YeetTaskInput[K]) => {
    setTask({ ...task, [key]: value });
  };

  const programReady = isLiveProgramConfigured();

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Task Submission</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-acid">
          {liveMode ? "on-chain" : "off-chain payload"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <ModeButton
          active={!liveMode}
          label="Simulation"
          hint="local swarm"
          onClick={() => setLiveMode(false)}
        />
        <ModeButton
          active={liveMode}
          label="Live On-chain"
          hint={programReady ? "Solana tx" : "set PROGRAM_ID"}
          onClick={() => setLiveMode(true)}
          disabled={!programReady}
        />
      </div>

      {liveMode ? (
        <div className="mb-4 space-y-3 border border-pulse/25 bg-pulse/[0.06] p-3 text-xs text-white/60">
          <div className="border border-acid/25 bg-acid/[0.08] p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">On-chain task id</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-2xl font-black text-acid">
                {displayedTaskId !== null ? `#${displayedTaskId}` : "—"}
              </span>
              {displayedTaskId !== null ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(displayedTaskId);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 border border-white/15 px-2 py-1 text-[10px] uppercase text-white/55"
                >
                  <Copy size={12} />
                  {copied ? "copied" : "copy"}
                </button>
              ) : null}
            </div>
            {displayedTaskId === null ? (
              <p className="mt-2 text-[10px] text-amber">
                Create a task below — the id appears here immediately (usually 0, 1, 2…). Demo: redundancy 1,
                difficulty 1, one claim.
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span>Phantom wallet</span>
            <button
              type="button"
              onClick={onConnectWallet}
              className="border border-pulse/30 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-pulse"
            >
              {walletConnected ? "connected" : "connect"}
            </button>
          </div>
          {lastTxSignature ? (
            <div className="truncate">
              Last tx:{" "}
              <a
                href={`https://explorer.solana.com/tx/${lastTxSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-acid hover:underline"
              >
                {lastTxSignature.slice(0, 16)}…
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        <label className="grid gap-1 text-xs text-white/60">
          Task name
          <input
            className="border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
            value={task.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-xs text-white/60">
          Task type
          <select
            className="border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
            value={task.type}
            onChange={(event) => update("type", event.target.value as TaskType)}
          >
            {Object.entries(taskLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Reward pool (0.001 SOL each)"
            value={task.rewardPool}
            min={1}
            max={10000}
            onChange={(value) => update("rewardPool", value)}
          />
          <NumberField label="Redundancy" value={task.redundancyFactor} min={1} max={8} onChange={(value) => update("redundancyFactor", value)} />
          <NumberField label="Difficulty (min claims)" value={task.difficulty} min={1} max={10} onChange={(value) => update("difficulty", value)} />
          <NumberField label="Timeout sec" value={task.executionTimeout} min={1} max={60} onChange={(value) => update("executionTimeout", value)} />
        </div>

        <label className="grid gap-2 text-xs text-white/60">
          Verification threshold: {task.verificationThreshold}%
          <input
            type="range"
            min={40}
            max={95}
            value={task.verificationThreshold}
            onChange={(event) => update("verificationThreshold", Number(event.target.value))}
            className="accent-pulse"
          />
        </label>

        <button
          onClick={onYeet}
          className="mt-2 inline-flex h-12 items-center justify-center gap-2 border border-acid/40 bg-acid/15 text-sm font-bold uppercase tracking-[0.22em] text-acid shadow-acid transition hover:bg-acid/25"
          type="button"
        >
          <SendHorizontal size={18} />
          {liveMode ? "CREATE ON-CHAIN TASK" : "YEET TASK"}
        </button>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  label,
  hint,
  onClick,
  disabled
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border p-2 text-left transition ${
        active
          ? "border-acid/40 bg-acid/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</div>
      <div className="text-[9px] text-white/40">{hint}</div>
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    queueMicrotask(() => setDraft(String(value)));
  }, [value]);

  function commitDraft() {
    const next = Number(draft);
    if (!Number.isFinite(next)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, next));
    setDraft(String(clamped));
    onChange(clamped);
  }

  return (
    <label className="grid gap-1 text-xs text-white/60">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="min-w-0 border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
      />
    </label>
  );
}
