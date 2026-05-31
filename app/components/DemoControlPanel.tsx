"use client";

import { RotateCcw, ShieldAlert, Sparkles } from "lucide-react";

type Props = {
  connected: boolean;
  onRunFlow: () => void;
  onArmMaliciousWorker: () => boolean;
  onResetStage: () => boolean;
};

export function DemoControlPanel({ connected, onRunFlow, onArmMaliciousWorker, onResetStage }: Props) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Demo Controls</h2>
        <span className={`text-[10px] uppercase tracking-[0.2em] ${connected ? "text-acid" : "text-amber"}`}>
          {connected ? "live stage" : "fallback"}
        </span>
      </div>

      <div className="grid gap-2">
        <button
          onClick={onRunFlow}
          className="inline-flex h-11 items-center justify-center gap-2 border border-acid/35 bg-acid/15 px-3 text-xs font-bold uppercase tracking-[0.16em] text-acid transition hover:bg-acid/25"
          type="button"
        >
          <Sparkles size={16} />
          Run judge flow
        </button>

        <button
          onClick={onArmMaliciousWorker}
          disabled={!connected}
          className="inline-flex h-11 items-center justify-center gap-2 border border-flare/35 bg-flare/10 px-3 text-xs font-bold uppercase tracking-[0.16em] text-flare transition hover:bg-flare/20 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
        >
          <ShieldAlert size={16} />
          Arm malicious node
        </button>

        <button
          onClick={onResetStage}
          disabled={!connected}
          className="inline-flex h-11 items-center justify-center gap-2 border border-white/15 bg-white/[0.04] px-3 text-xs font-bold uppercase tracking-[0.16em] text-white/65 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
        >
          <RotateCcw size={16} />
          Reset live stage
        </button>
      </div>
    </section>
  );
}
