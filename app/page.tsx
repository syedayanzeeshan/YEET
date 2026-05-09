"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Binary, Network, ShieldCheck } from "lucide-react";
import { ConsensusTimeline } from "@/app/components/ConsensusTimeline";
import { NodeMonitor } from "@/app/components/NodeMonitor";
import { RewardFlow } from "@/app/components/RewardFlow";
import { SolanaArchitecture } from "@/app/components/SolanaArchitecture";
import { SwarmGraph } from "@/app/components/SwarmGraph";
import { TaskSubmissionPanel } from "@/app/components/TaskSubmissionPanel";
import { WalletButton } from "@/app/components/WalletButton";
import { buildDemoSwarm, defaultTask } from "@/app/lib/yeetSimulation";
import { YeetTaskInput } from "@/app/types/yeet";

export default function Home() {
  const [task, setTask] = useState<YeetTaskInput>(defaultTask);
  const [demoNonce, setDemoNonce] = useState(0);
  const [activeRound, setActiveRound] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const demo = useMemo(() => buildDemoSwarm(task), [task]);
  const round = demo.rounds[activeRound];

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  function yeetTask() {
    setDemoNonce((value) => value + 1);
    runDemo(0);
  }

  function runDemo(startIndex = activeRound) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    setActiveRound(startIndex);
    setIsAutoplaying(true);
    timerRef.current = window.setInterval(() => {
      setActiveRound((index) => {
        if (index >= demo.rounds.length - 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
          }
          setIsAutoplaying(false);
          return index;
        }
        return index + 1;
      });
    }, 2200);
  }

  function pauseDemo() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsAutoplaying(false);
  }

  function selectRound(index: number) {
    pauseDemo();
    setActiveRound(index);
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="relative border-b border-white/10">
        <div className="grid-noise absolute inset-0" />
        <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <section className="flex min-h-[420px] flex-col justify-between">
            <nav className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center border border-acid/40 bg-acid/10 text-acid shadow-acid">
                  <Binary size={22} />
                </div>
                <div>
                  <div className="text-xl font-black uppercase tracking-[0.22em] text-white">YEET</div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Solana-native compute coordination</div>
                </div>
              </div>
              <WalletButton />
            </nav>

            <div className="max-w-4xl py-10">
              <p className="mt-4 max-w-3xl text-sm uppercase tracking-[0.18em] text-pulse md:text-base">
                Distributed AI coordination with adversarial verification and Solana settlement.
              </p>
              <motion.h1
                className="text-4xl font-black uppercase leading-tight tracking-normal text-white md:text-6xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Solana-native compute swarms where correctness fights back.
              </motion.h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
                YEET is an adversarial compute coordination protocol: off-chain execution, on-chain accountability,
                and high-frequency settlement designed for Solana.
              </p>
              <p className="mt-4 max-w-2xl border-l border-acid/60 pl-4 text-lg font-black uppercase leading-7 tracking-normal text-acid">
                YEET rewards nodes for proving the network wrong.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Signal icon={<Network size={16} />} label="Dormant compute" value="10 nodes" />
              <Signal icon={<Activity size={16} />} label="Swarm state" value={round.state} />
              <Signal icon={<ShieldCheck size={16} />} label="Correctness market" value="armed" />
              <Signal icon={<Binary size={16} />} label="Settlement" value="Solana-ready" />
            </div>
          </section>

          <SwarmGraph nodes={demo.nodes} assignedNodeIds={demo.assignedNodeIds} round={round} pulse={activeRound + demoNonce} />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-5 py-5 lg:grid-cols-[340px_1fr_360px] lg:px-8">
        <div className="grid content-start gap-4">
          <TaskSubmissionPanel task={task} setTask={setTask} onYeet={yeetTask} />
          <ConsensusTimeline
            rounds={demo.rounds}
            activeIndex={activeRound}
            onSelect={selectRound}
            isAutoplaying={isAutoplaying}
            onPlay={() => runDemo(activeRound)}
            onPause={pauseDemo}
          />
        </div>

        <section className="border border-white/10 bg-panel/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Network Dashboard</h2>
            <span className="text-[10px] uppercase tracking-[0.2em] text-acid">off-chain execution</span>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <InfoTile label="Task propagation" value={activeRound > 0 ? "in-flight" : "standby"} tone="pulse" />
            <InfoTile label="Consensus state" value={round.state} tone={round.state === "slashing" ? "flare" : "acid"} />
            <InfoTile label="Malicious detection" value={round.slashedNodeIds.length ? "proven" : activeRound >= 3 ? "challenged" : "watching"} tone="flare" />
            <InfoTile label="Settlement layer" value="Solana" tone="pulse" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">Adversarial output agreement</div>
              <div className="grid gap-2">
                {round.outputs.length === 0 ? (
                  <div className="text-sm text-white/45">Waiting for executors to return independent digests.</div>
                ) : (
                  round.outputs.map((output) => (
                    <div
                      key={output.nodeId}
                      className={`flex items-center justify-between gap-3 border px-3 py-2 text-xs ${output.malicious ? "border-flare/40 bg-flare/[0.08]" : "border-acid/25 bg-acid/[0.06]"
                        }`}
                    >
                      <span className="text-white/70">{output.nodeId}</span>
                      <span className="truncate text-white">{output.digest}</span>
                      <span className={output.malicious ? "text-flare" : "text-acid"}>{output.confidence}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">Current market event</div>
              <h3 className="text-xl font-bold text-white">{round.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{round.description}</p>
              <div className="mt-4 border border-pulse/20 bg-pulse/[0.06] p-3 text-xs leading-5 text-pulse">
                Correctness is a market: execution, validation, challenge proof, reputation, and slashing all affect settlement.
              </div>
            </div>
          </div>
        </section>

        <div className="grid content-start gap-4">
          <NodeMonitor nodes={demo.nodes} assignedNodeIds={demo.assignedNodeIds} />
          <RewardFlow round={round} rewardPool={task.rewardPool} />
        </div>
      </div>
      <WhyThisMatters />
      <SolanaArchitecture />
      <footer className="border-t border-white/10 bg-black/40 py-4 text-center text-xs uppercase tracking-[0.25em] text-white/40">
        ayan · uswa · tamveel
      </footer>
    </main>
  );
}

function WhyThisMatters() {
  return (
    <>
      <section className="border-t border-white/10 bg-void/70 px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-3 inline-flex border border-flare/25 bg-flare/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-flare">
              Why this matters
            </div>

            <h2 className="text-3xl font-black uppercase leading-tight tracking-normal text-white md:text-4xl">
              AI infrastructure is centralizing around whoever can afford the machines.
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-6 text-white/55">
              Compute access is becoming increasingly gated by hyperscalers, GPU scarcity,
              and centralized orchestration layers. YEET explores a different model:
              temporary decentralized compute swarms coordinated through adversarial incentives.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MatterTile
              title="Compute access"
              copy="GPU prices and cloud queues push small developers away from serious AI experimentation."
            />

            <MatterTile
              title="Hyperscaler pressure"
              copy="Centralized AI infrastructure concentrates pricing power, policy power, and execution visibility."
            />

            <MatterTile
              title="Consumer participation"
              copy="Idle hardware can become temporary AI infrastructure when coordination and accountability are solved."
            />

            <MatterTile
              title="Verified execution"
              copy="YEET makes correctness economically contested instead of assuming every worker is honest."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/30 px-5 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-5 inline-flex border border-acid/25 bg-acid/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-acid">
            Why Solana
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <InfoTile
              label="Micro settlement"
              value="low-cost rewards"
              tone="acid"
            />

            <InfoTile
              label="Parallel execution"
              value="multi-task swarms"
              tone="pulse"
            />

            <InfoTile
              label="High throughput"
              value="real-time accounting"
              tone="acid"
            />

            <InfoTile
              label="Fast finality"
              value="low-latency disputes"
              tone="pulse"
            />

            <InfoTile
              label="Protocol fit"
              value="coordination markets"
              tone="flare"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-void/60 px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="mb-3 inline-flex border border-pulse/25 bg-pulse/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-pulse">
              Protocol design
            </div>

            <h2 className="text-3xl font-black uppercase leading-tight tracking-normal text-white">
              Temporary compute swarms with adversarial consensus.
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MatterTile
              title="Off-chain execution"
              copy="Heavy compute and model execution remain off-chain to avoid blockchain bottlenecks."
            />

            <MatterTile
              title="On-chain accountability"
              copy="Task registration, staking, slashing, and settlement are anchored through Solana."
            />

            <MatterTile
              title="Redundant verification"
              copy="Independent nodes execute identical tasks to detect divergence and malicious outputs."
            />

            <MatterTile
              title="Challenger incentives"
              copy="Nodes are rewarded for successfully disputing suspicious consensus instead of blindly matching the majority."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/30 px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-3 inline-flex border border-flare/25 bg-flare/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-flare">
              MVP scope
            </div>

            <h2 className="text-3xl font-black uppercase leading-tight tracking-normal text-white">
              A protocol simulation focused on coordination economics and UX.
            </h2>
          </div>

          <div className="border border-white/10 bg-white/[0.035] p-5 text-sm leading-7 text-white/60">
            This MVP intentionally simulates swarm coordination, adversarial consensus,
            validator disagreement, and slashing mechanics in order to demonstrate the
            protocol architecture, economic incentives, and user experience.
            <br />
            <br />
            Real peer-to-peer orchestration, distributed inference execution,
            cryptographic verification, and decentralized scheduling are future expansion phases
            and intentionally out of scope for the hackathon version.
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-void/60 px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="mb-3 inline-flex border border-acid/25 bg-acid/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-acid">
              Future expansion
            </div>

            <h2 className="text-3xl font-black uppercase leading-tight tracking-normal text-white">
              Beyond the demo swarm.
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MatterTile
              title="TEE-backed execution"
              copy="Trusted execution environments for stronger compute integrity guarantees."
            />

            <MatterTile
              title="zk verification"
              copy="Proof systems for lightweight verification of expensive computation."
            />

            <MatterTile
              title="Distributed inference"
              copy="Consumer hardware participating in decentralized AI inference markets."
            />

            <MatterTile
              title="Reputation graph"
              copy="Long-term reliability scoring and adaptive swarm selection."
            />

            <MatterTile
              title="Decentralized orchestration"
              copy="Reducing coordinator trust assumptions through distributed scheduling."
            />

            <MatterTile
              title="Fine-tuning swarms"
              copy="Future support for collaborative distributed training and tuning workloads."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/30 px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="mb-3 inline-flex border border-pulse/25 bg-pulse/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-pulse">
              Differentiation
            </div>

            <h2 className="text-3xl font-black uppercase leading-tight tracking-normal text-white">
              YEET focuses on correctness markets, not just distributed compute access.
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MatterTile
              title="Adversarial consensus"
              copy="Independent challengers are economically incentivized to dispute suspicious outputs."
            />

            <MatterTile
              title="Temporary swarms"
              copy="Nodes dynamically form around tasks instead of remaining in static persistent clusters."
            />

            <MatterTile
              title="Economic slashing"
              copy="Dishonest execution loses stake instead of merely failing reputation checks."
            />

            <MatterTile
              title="Coordination-first architecture"
              copy="YEET explores decentralized coordination and verification economics as the core primitive."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function MatterTile({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-white/55">{copy}</p>
    </div>
  );
}

function Signal({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-bold uppercase text-white">{value}</div>
    </div>
  );
}

function InfoTile({ label, value, tone }: { label: string; value: string; tone: "pulse" | "acid" | "flare" }) {
  const classes = {
    pulse: "border-pulse/25 bg-pulse/[0.07] text-pulse",
    acid: "border-acid/25 bg-acid/[0.07] text-acid",
    flare: "border-flare/25 bg-flare/[0.07] text-flare"
  };

  return (
    <div className={`border p-4 ${classes[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-lg font-black uppercase">{value}</div>
    </div>
  );
}
