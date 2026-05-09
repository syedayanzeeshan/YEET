"use client";

import { motion } from "framer-motion";
import { FastForward, PauseCircle, PlayCircle } from "lucide-react";
import { ConsensusRound } from "@/app/types/yeet";

type Props = {
  rounds: ConsensusRound[];
  activeIndex: number;
  onSelect: (index: number) => void;
  isAutoplaying: boolean;
  onPlay: () => void;
  onPause: () => void;
};

export function ConsensusTimeline({ rounds, activeIndex, onSelect, isAutoplaying, onPlay, onPause }: Props) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Adversarial Consensus</h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">phase drives correctness market state</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-flare">adversarial market</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <button
          onClick={onPlay}
          className={`inline-flex h-9 items-center justify-center gap-2 border text-[10px] uppercase tracking-[0.16em] transition ${
            isAutoplaying ? "border-acid/35 bg-acid/15 text-acid" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-acid/30"
          }`}
          type="button"
        >
          <PlayCircle size={14} />
          Run
        </button>
        <button
          onClick={onPause}
          className="inline-flex h-9 items-center justify-center gap-2 border border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-white/55 transition hover:border-pulse/30"
          type="button"
        >
          <PauseCircle size={14} />
          Hold
        </button>
        <button
          onClick={() => onSelect(rounds.length - 1)}
          className="inline-flex h-9 items-center justify-center gap-2 border border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-white/55 transition hover:border-flare/30"
          type="button"
        >
          <FastForward size={14} />
          Resolve
        </button>
      </div>

      <div className="grid gap-2">
        {rounds.map((round, index) => (
          <button
            key={round.state}
            onClick={() => onSelect(index)}
            className={`relative overflow-hidden border p-3 text-left transition ${
              index === activeIndex ? "border-pulse bg-pulse/15 text-white" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25"
            }`}
            type="button"
          >
            {index === activeIndex ? (
              <motion.div
                className="absolute inset-y-0 left-0 w-1 bg-pulse"
                layoutId="timeline-active"
              />
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{round.title}</span>
              <span className="text-[10px] uppercase text-white/40">{round.state}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">{round.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
