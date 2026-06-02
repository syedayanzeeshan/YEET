"use client";

import { useState } from "react";
import { Cpu, Loader2, Shield, Swords, Trophy, UserCheck } from "lucide-react";
import type { YeetNode } from "@/app/types/yeet";
import type { OnChainNodeProfile } from "@/app/lib/solana/yeetProgram";

type Props = {
  nodes: YeetNode[];
  assignedNodeIds: string[];
  liveMode?: boolean;
  onRegisterNode?: (hardwareLabel: string, rolePreference: 0 | 1 | 2 | 3) => Promise<void>;
  nodeProfile?: OnChainNodeProfile | null;
};

export function NodeMonitor({ nodes, assignedNodeIds, liveMode = false, onRegisterNode, nodeProfile }: Props) {
  const assigned = new Set(assignedNodeIds);
  const [registering, setRegistering] = useState(false);
  const [label, setLabel] = useState("");
  const [rolePreference, setRolePreference] = useState<0 | 1 | 2 | 3>(0);
  const [showRegForm, setShowRegForm] = useState(false);

  async function handleRegister() {
    if (!onRegisterNode || !label.trim()) return;
    setRegistering(true);
    try {
      await onRegisterNode(label.trim(), rolePreference);
      setShowRegForm(false);
      setLabel("");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Node Monitor</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-pulse">{nodes.length} live nodes</span>
      </div>

      {/* On-chain node profile badge */}
      {liveMode && nodeProfile ? (
        <div className="mb-4 border border-acid/25 bg-acid/[0.07] p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-acid">
            <UserCheck size={12} />
            registered on-chain
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ProfileStat label="rep" value={String(nodeProfile.reputationScore)} tone="acid" />
            <ProfileStat label="slash" value={String(nodeProfile.slashCount)} tone="flare" />
            <ProfileStat label="wins" value={String(nodeProfile.challengeWins)} tone="amber" />
            <ProfileStat label="tasks" value={String(nodeProfile.totalTasks)} tone="pulse" />
          </div>
        </div>
      ) : null}

      {/* Register node CTA in live mode */}
      {liveMode && !nodeProfile && onRegisterNode ? (
        <div className="mb-4">
          {!showRegForm ? (
            <button
              type="button"
              onClick={() => setShowRegForm(true)}
              className="inline-flex h-9 w-full items-center justify-center gap-2 border border-acid/30 bg-acid/[0.07] text-[10px] font-bold uppercase tracking-[0.16em] text-acid transition hover:bg-acid/15"
            >
              <UserCheck size={13} />
              Register node on-chain
            </button>
          ) : (
            <div className="space-y-2 border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Node registration</div>
              <input
                className="w-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-acid"
                placeholder="Hardware label (e.g. RTX 3090)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <div className="grid grid-cols-4 gap-1">
                {(["executor", "validator", "challenger", "hybrid"] as const).map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRolePreference(i as 0 | 1 | 2 | 3)}
                    className={`border px-1 py-1 text-[9px] uppercase transition ${
                      rolePreference === i
                        ? "border-acid/40 bg-acid/15 text-acid"
                        : "border-white/10 text-white/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={registering || !label.trim()}
                  onClick={() => void handleRegister()}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-acid/35 bg-acid/15 text-[10px] font-bold uppercase tracking-[0.14em] text-acid disabled:opacity-40"
                >
                  {registering ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  {registering ? "Registering…" : "Register"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegForm(false)}
                  className="border border-white/15 px-3 text-[10px] uppercase text-white/45"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="thin-scrollbar grid max-h-[380px] gap-2 overflow-auto pr-1">
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
              <span className={`text-[10px] uppercase ${node.status === "slashed" ? "text-flare" : "text-acid"}`}>
                {node.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] text-white/60">
              <NodeMetric icon={<Shield size={12} />} label="rel" value={`${node.reliability}%`} />
              <NodeMetric icon={<Swords size={12} />} label="stake" value={`${node.stake}`} />
              <NodeMetric icon={<Trophy size={12} />} label="earn" value={`${node.rewardsEarned}`} />
              <NodeMetric icon={<Shield size={12} />} label="fraud" value={`${node.fraudHistory}`} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NodeMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function ProfileStat({ label, value, tone }: { label: string; value: string; tone: "acid" | "pulse" | "flare" | "amber" }) {
  const cls = { acid: "text-acid", pulse: "text-pulse", flare: "text-flare", amber: "text-amber" }[tone];
  return (
    <div className="border border-white/10 bg-black/20 p-2 text-center">
      <div className="text-[9px] uppercase text-white/40">{label}</div>
      <div className={`mt-1 text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}
