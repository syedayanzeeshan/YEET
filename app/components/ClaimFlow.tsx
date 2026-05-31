"use client";

import { ConsensusRound, RewardEvent } from "@/app/types/yeet";

type Props = {
  round: ConsensusRound;
  rewardPool: number;
};

export function RewardFlow({ round, rewardPool }: Props) {
  const events = round.rewardEvents;

  const positive = events.filter((event) => event.delta > 0 && !isChallengerBonus(event));
  const challengerBonus = events.filter(isChallengerBonus);
  const slashing = events.filter((event) => event.delta < 0);

  const totalPositive = positive.reduce((sum, event) => sum + event.delta, 0);
  const totalChallenger = challengerBonus.reduce((sum, event) => sum + event.delta, 0);
  const totalSlashed = slashing.reduce((sum, event) => sum + Math.abs(event.delta), 0);

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Reward Flow</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-acid">{rewardPool} pool</span>
      </div>

      {round.verifiedDigest ? (
        <div className="mb-4 border border-acid/25 bg-acid/[0.06] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Canonical result</div>
          <div className="mt-1 break-all text-xs text-acid">{round.verifiedDigest}</div>
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="text-xs text-white/45">Rewards settle after slashing phase.</div>
      ) : (
        <div className="grid gap-4">
          {positive.length > 0 ? (
            <RewardGroup
              title="Execution & validation rewards"
              subtitle={`+${totalPositive} YEET`}
              events={positive}
              tone="acid"
            />
          ) : null}

          {challengerBonus.length > 0 ? (
            <RewardGroup
              title="Challenger bonus"
              subtitle={`+${totalChallenger} YEET`}
              events={challengerBonus}
              tone="amber"
            />
          ) : null}

          {slashing.length > 0 ? (
            <RewardGroup
              title="Slashing penalties"
              subtitle={`−${totalSlashed} stake`}
              events={slashing}
              tone="flare"
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function isChallengerBonus(event: RewardEvent): boolean {
  return event.reason.includes("challenge");
}

function RewardGroup({
  title,
  subtitle,
  events,
  tone
}: {
  title: string;
  subtitle: string;
  events: RewardEvent[];
  tone: "acid" | "amber" | "flare";
}) {
  const borderClass = {
    acid: "border-acid/25",
    amber: "border-amber/25",
    flare: "border-flare/25"
  }[tone];

  const textClass = {
    acid: "text-acid",
    amber: "text-amber",
    flare: "text-flare"
  }[tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">{title}</span>
        <span className={`text-[10px] font-bold uppercase ${textClass}`}>{subtitle}</span>
      </div>
      <div className="grid gap-1">
        {events.map((event) => (
          <div
            key={`${event.nodeId}-${event.reason}`}
            className={`flex items-center justify-between gap-2 border bg-black/20 px-3 py-2 text-xs ${borderClass}`}
          >
            <div>
              <div className="text-white">{event.label}</div>
              <div className="text-white/40">{event.reason}</div>
            </div>
            <span className={textClass}>
              {event.delta > 0 ? "+" : ""}
              {event.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
