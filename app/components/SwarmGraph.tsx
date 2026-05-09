"use client";

import { motion } from "framer-motion";
import { Activity, ShieldAlert, Zap } from "lucide-react";
import { ConsensusRound, YeetNode } from "@/app/types/yeet";

type SwarmGraphProps = {
  nodes: YeetNode[];
  assignedNodeIds: string[];
  round: ConsensusRound;
  pulse: number;
};

export function SwarmGraph({ nodes, assignedNodeIds, round, pulse }: SwarmGraphProps) {
  const assigned = new Set(assignedNodeIds);
  const slashed = new Set(round.slashedNodeIds);

  return (
    <div className="scanline relative min-h-[520px] overflow-hidden border border-white/10 bg-ink/70 shadow-glow">
      <div className="grid-noise absolute inset-0 opacity-70" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.map((node) =>
          assigned.has(node.id) ? (
            <motion.line
              key={`link-${node.id}-${pulse}`}
              x1="50"
              y1="50"
              x2={node.x}
              y2={node.y}
              stroke={slashed.has(node.id) ? "rgba(255,63,129,0.8)" : "rgba(32,228,255,0.45)"}
              strokeWidth={slashed.has(node.id) ? 0.7 : 0.35}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: assigned.has(node.id) ? 1 : 0.25 }}
              transition={{ duration: 0.7, delay: 0.02 * pulse }}
            />
          ) : null
        )}
      </svg>

      <motion.div
        className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-acid/50 bg-acid/10 text-acid shadow-acid"
        animate={{ scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <div className="text-center">
          <Zap className="mx-auto mb-1" size={24} />
          <div className="text-[10px] uppercase tracking-[0.24em]">YEET</div>
          <div className="text-[9px] text-white/60">{round.state}</div>
        </div>
      </motion.div>

      {nodes.map((node, index) => {
        const isAssigned = assigned.has(node.id);
        const isSlashed = slashed.has(node.id);
        const isChallenger = round.challengerId === node.id;

        return (
          <motion.div
            key={node.id}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 border px-2 py-1 text-[10px] shadow-lg ${
              isSlashed
                ? "border-flare bg-flare/20 text-flare shadow-flare"
                : isChallenger
                  ? "border-amber bg-amber/15 text-amber shadow-acid"
                  : isAssigned
                    ? "border-pulse bg-pulse/15 text-pulse shadow-glow"
                    : "border-white/10 bg-white/5 text-white/45"
            }`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            animate={{
              x: [0, index % 2 ? 4 : -4, 0],
              y: [0, index % 3 ? -3 : 3, 0],
              opacity: isAssigned ? 1 : 0.54
            }}
            transition={{ duration: 3 + index * 0.12, repeat: Infinity }}
          >
            <div className="flex items-center gap-1">
              {isSlashed ? <ShieldAlert size={12} /> : <Activity size={12} />}
              <span>{node.alias}</span>
            </div>
            <div className="text-[8px] uppercase text-white/45">{node.activeRole}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
