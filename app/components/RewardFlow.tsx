"use client";

import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";
import { ConsensusRound } from "@/app/types/yeet";

export function RewardFlow({ round, rewardPool }: { round: ConsensusRound; rewardPool: number }) {
  const positive = round.rewardEvents.filter((event) => event.delta >= 0);
  const negative = round.rewardEvents.filter((event) => event.delta < 0);
  const totalDistributed = positive.reduce((sum, event) => sum + event.delta, 0);
  const totalSlashed = Math.abs(negative.reduce((sum, event) => sum + event.delta, 0));
  const efficiency = rewardPool > 0 ? Math.round((totalDistributed / rewardPool) * 100) : 0;

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Settlement Flow</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber">Solana-ready</span>
      </div>

      <div className="grid gap-2">
        {round.verifiedDigest ? (
          <div className="border border-acid/30 bg-acid/10 p-3 text-xs text-acid">
            <CheckCircle2 className="mb-2" size={16} />
            Verified result: {round.verifiedDigest}
          </div>
        ) : (
          <div className="border border-white/10 bg-white/[0.03] p-3 text-xs text-white/50">Awaiting consensus resolution.</div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <SummaryMetric label="paid" value={`${totalDistributed}`} tone="acid" />
          <SummaryMetric label="slashed" value={`${totalSlashed}`} tone="flare" />
          <SummaryMetric label="eff" value={`${efficiency}%`} tone="pulse" />
        </div>

        {[...positive, ...negative].slice(0, 6).map((event) => (
          <div
            key={`${event.nodeId}-${event.reason}`}
            className={`flex items-center justify-between gap-3 border p-3 text-xs ${
              event.delta >= 0 ? "border-acid/20 bg-acid/[0.06]" : "border-flare/30 bg-flare/[0.08]"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white">
                {event.delta >= 0 ? <ArrowUp size={14} className="text-acid" /> : <ArrowDown size={14} className="text-flare" />}
                <span>{event.label}</span>
              </div>
              <div className="mt-1 truncate text-white/45">{event.reason}</div>
            </div>
            <div className={event.delta >= 0 ? "text-acid" : "text-flare"}>
              {event.delta >= 0 ? "+" : ""}
              {event.delta}
            </div>
          </div>
        ))}

        {negative.length > 0 ? (
          <div className="border border-flare/30 bg-flare/[0.08] p-3 text-xs text-flare">
            <XCircle className="mb-2" size={16} />
            Minority correctness prevents lazy consensus copying: fraud loses stake when a challenger proves network divergence.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: "acid" | "flare" | "pulse" }) {
  const classes = {
    acid: "border-acid/25 bg-acid/[0.07] text-acid",
    flare: "border-flare/25 bg-flare/[0.07] text-flare",
    pulse: "border-pulse/25 bg-pulse/[0.07] text-pulse"
  };

  return (
    <div className={`border p-2 ${classes[tone]}`}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}
