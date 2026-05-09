"use client";

import { Cpu, Shield, Swords, Trophy } from "lucide-react";
import { YeetNode } from "@/app/types/yeet";

export function NodeMonitor({ nodes, assignedNodeIds }: { nodes: YeetNode[]; assignedNodeIds: string[] }) {
  const assigned = new Set(assignedNodeIds);

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Node Monitor</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-pulse">{nodes.length} live nodes</span>
      </div>

      <div className="thin-scrollbar grid max-h-[430px] gap-2 overflow-auto pr-1">
        {nodes.map((node) => (
          <article
            key={node.id}
            className={`border p-3 transition ${
              assigned.has(node.id) ? "border-pulse/40 bg-pulse/[0.07]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <Cpu size={15} className="text-pulse" />
                  {node.alias}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/40">{node.hardware.label}</div>
              </div>
              <span className={`text-[10px] uppercase ${node.status === "slashed" ? "text-flare" : "text-acid"}`}>{node.status}</span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] text-white/60">
              <Metric icon={<Shield size={12} />} label="rel" value={`${node.reliabilityScore}%`} />
              <Metric icon={<Swords size={12} />} label="stake" value={`${node.stake}`} />
              <Metric icon={<Trophy size={12} />} label="earn" value={`${node.rewardsEarned}`} />
              <Metric icon={<Shield size={12} />} label="fraud" value={`${node.fraudHistory}`} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-2">
      <div className="flex items-center gap-1 text-white/40">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}
