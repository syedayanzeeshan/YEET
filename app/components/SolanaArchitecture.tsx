"use client";

import { ArrowRight, Cpu, Gavel, GitBranch, Layers3, ShieldCheck, Zap } from "lucide-react";

const layers = [
  {
    icon: <Cpu size={18} />,
    title: "Consumer Nodes",
    copy: "Idle GPUs and laptops register with stake, hardware profile, role preference, and reputation state."
  },
  {
    icon: <GitBranch size={18} />,
    title: "Ephemeral Swarm",
    copy: "A temporary off-chain execution group forms around each task, runs redundant compute, and exposes divergence."
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Adversarial Verification",
    copy: "Validators compare outputs while challengers earn more for proving suspicious consensus wrong."
  },
  {
    icon: <Zap size={18} />,
    title: "Solana Settlement",
    copy: "Anchor programs would settle stake, slashing, micro-rewards, and PDA-based node reputation at low latency."
  }
];

const roadmap = [
  "Simulation + economic model validation : Validate adversarial compute markets in a controlled simulation environment. Focus on correctness incentives, slashing logic, and swarm coordination behavior without real-world execution risk.",
  "Solana program layer (Anchor migration) : Port core coordination logic into a Solana program using Anchor. Implement task registration, stake locking, and basic settlement primitives on-chain.",
  "Signed execution + real node networking : Introduce external nodes that execute tasks and return signed results. Validate correctness through cryptographic receipts and disagreement resolution.",
  "Distributed workload expansion (AI inference class tasks) : Generalize task execution beyond simulation workloads into structured compute tasks such as inference, verification, and deterministic computation.",
  "Cryptographic verification hardening : Add stronger verification mechanisms (proof aggregation, partial verification, or trust-minimized attestations depending on feasibility constraints).",
  "Open compute marketplace layer : Expose the system as a permissionless compute coordination market where independent operators can participate, compete, and settle computation tasks transparently."
];

export function SolanaArchitecture() {
  return (
    <section className="border-t border-white/10 bg-black/35 px-5 py-8 lg:px-8">
      <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-3 inline-flex border border-pulse/25 bg-pulse/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-pulse">
            Solana-native protocol path
          </div>
          <h2 className="max-w-3xl text-3xl font-black uppercase leading-tight tracking-normal text-white md:text-4xl">
            Off-chain execution, on-chain accountability.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/62">
            YEET uses Solana as the economic verification and settlement layer for adversarially validated compute swarms.
            The MVP simulates execution and consensus today; the protocol direction is Anchor-based staking, slashing,
            reputation, and high-frequency correctness payouts.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Principle icon={<Gavel size={16} />} label="Correctness markets" value="nodes are paid for useful verification, not passive agreement" />
            <Principle icon={<ShieldCheck size={16} />} label="Minority correctness" value="challengers earn when they prove the network wrong" />
            <Principle icon={<Layers3 size={16} />} label="Solana settlement" value="low-fee micro-rewards and slashing events map cleanly to program state" />
            <Principle icon={<Zap size={16} />} label="Parallel coordination" value="independent task swarms can settle without a monolithic coordinator" />
          </div>
        </div>

        <div className="border border-white/10 bg-panel/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-[0.22em] text-white/80">Future Solana Architecture</h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-acid">Anchor target</span>
          </div>

          <div className="grid gap-2">
            {layers.map((layer, index) => (
              <div key={layer.title} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div className="border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
                    <span className="text-pulse">{layer.icon}</span>
                    {layer.title}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/52">{layer.copy}</p>
                </div>
                {index < layers.length - 1 ? <ArrowRight className="text-white/22" size={16} /> : <div className="w-4" />}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-panel/80 p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm uppercase tracking-[0.22em] text-white/80">Roadmap</h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">realistic migration path</span>
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {roadmap.map((item, index) => (
              <div key={item} className="border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-pulse">Phase {index + 1}</div>
                <div className="mt-2 text-xs leading-5 text-white/64">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Principle({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-acid">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xs leading-5 text-white/55">{value}</p>
    </div>
  );
}
