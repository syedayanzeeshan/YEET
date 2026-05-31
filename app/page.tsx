"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Activity, Binary, Network, ShieldCheck } from "lucide-react";
import { ConsensusTimeline } from "@/app/components/ConsensusTimeline";
import {
  LiveEventFeed,
  NetworkMetricsPanel,
  ReceiptPanel,
  ReputationStrip,
  TaskLifecyclePanel
} from "@/app/components/LiveInfrastructurePanels";
import { DemoControlPanel } from "@/app/components/DemoControlPanel";
import { LiveClaimPanel } from "@/app/components/LiveClaimPanel";
import { NodeMonitor } from "@/app/components/NodeMonitor";
import { ProofPanel } from "@/app/components/ProofPanel";
import { RewardFlow } from "@/app/components/ClaimFlow";
import { SolanaArchitecture } from "@/app/components/SolanaArchitecture";
import { SwarmGraph } from "@/app/components/SwarmGraph";
import { TaskSubmissionPanel } from "@/app/components/TaskSubmissionPanel";
import { WalletButton } from "@/app/components/WalletButton";
import { useSwarmSocket } from "@/app/lib/useSwarmSocket";
import { buildDemoSwarm, defaultTask } from "@/app/lib/yeetSimulation";
import {
  canonicalResultHex,
  connectPhantomWallet,
  type OnChainClaim,
  type OnChainTaskState,
  type SolanaWallet
} from "@/app/lib/solana/yeetProgram";
import { ConsensusRound, ExecutionOutput, RewardEvent, YeetTaskInput } from "@/app/types/yeet";

export default function Home() {
  const [task, setTask] = useState<YeetTaskInput>(defaultTask);
  const [demoNonce, setDemoNonce] = useState(0);
  const [activeRound, setActiveRound] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [solanaWallet, setSolanaWallet] = useState<SolanaWallet | null>(null);
  const timerRef = useRef<number | null>(null);
  const demo = useMemo(() => buildDemoSwarm(task), [task]);
  const swarmSocket = useSwarmSocket(undefined, {
    liveMode,
    wallet: solanaWallet,
    task,
    onWalletConnected: setSolanaWallet
  });
  const displayedTaskId = swarmSocket.activeTaskId?.toString() ?? null;
  const liveRound = useMemo(
    () =>
      liveMode
        ? buildLiveRound({
            task,
            taskId: displayedTaskId,
            claims: swarmSocket.onChainClaims,
            taskState: swarmSocket.onChainTaskState,
            canonicalResult: swarmSocket.onChainResult
          })
        : null,
    [liveMode, task, displayedTaskId, swarmSocket.onChainClaims, swarmSocket.onChainTaskState, swarmSocket.onChainResult]
  );
  const round = liveRound ?? swarmSocket.currentRound ?? demo.rounds[activeRound];
  const displayedRoundIndex = swarmSocket.currentRound
    ? Math.max(0, demo.rounds.findIndex((candidate) => candidate.state === swarmSocket.currentRound?.state))
    : liveRound
      ? Math.max(0, demo.rounds.findIndex((candidate) => candidate.state === liveRound.state))
    : activeRound;
  const liveNodes = swarmSocket.nodes.length > 0 ? swarmSocket.nodes : demo.nodes;
  const assignedNodeIds = swarmSocket.assignedNodeIds.length > 0 ? swarmSocket.assignedNodeIds : demo.assignedNodeIds;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  async function yeetTask() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    setDemoNonce((value) => value + 1);

    if (liveMode) {
      pauseDemo();
      const result = await swarmSocket.dispatchTask(task);
      if (result) setActiveRound(0);
      return;
    }

    const result = await swarmSocket.dispatchTask(task);
    if (result === true) {
      pauseDemo();
      setActiveRound(0);
      return;
    }
    runDemo(0);
  }

  async function connectSolanaWallet() {
    const wallet = await connectPhantomWallet();
    setSolanaWallet(wallet);
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
                <div className="relative grid h-10 w-10 place-items-center overflow-hidden border border-acid/40 bg-black shadow-acid">
                  <Image src="/yeet-logo.png" alt="YEET" width={40} height={40} className="object-contain" priority />
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
              <Signal icon={<Network size={16} />} label="Dormant compute" value={`${liveNodes.length || 10} nodes`} />
              <Signal icon={<Activity size={16} />} label="Swarm state" value={round.state} />
              <Signal icon={<ShieldCheck size={16} />} label="Correctness market" value="armed" />
              <Signal icon={<Binary size={16} />} label="Settlement" value="Solana-ready" />
            </div>
          </section>

          <SwarmGraph nodes={liveNodes} assignedNodeIds={assignedNodeIds} round={round} pulse={displayedRoundIndex + demoNonce} />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-5 py-5 xl:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <div className="grid content-start gap-4">
          <DemoControlPanel
            connected={swarmSocket.connected}
            onRunFlow={yeetTask}
            onArmMaliciousWorker={() => {
              void swarmSocket.armMaliciousWorker();
              return true;
            }}
            onResetStage={swarmSocket.resetDemo}
          />
          <TaskSubmissionPanel
            task={task}
            setTask={setTask}
            onYeet={yeetTask}
            liveMode={liveMode}
            setLiveMode={setLiveMode}
            onConnectWallet={connectSolanaWallet}
            walletConnected={Boolean(solanaWallet?.publicKey)}
            activeTaskId={displayedTaskId}
            lastTxSignature={swarmSocket.lastTxSignature}
          />
          {liveMode ? (
            <LiveClaimPanel
              task={task}
              activeTaskId={displayedTaskId}
              claims={swarmSocket.onChainClaims}
              taskState={swarmSocket.onChainTaskState}
              lastTxSignature={swarmSocket.lastTxSignature}
              connectedWallet={solanaWallet?.publicKey.toBase58() ?? null}
              onSignAndSend={swarmSocket.submitClaimForNode}
              onResolve={(taskId) => swarmSocket.resolveOnChain(BigInt(taskId))}
              onRefresh={() => void swarmSocket.refreshOnChainState(undefined, true, true)}
              onTaskIdChange={(taskId) => {
                const trimmed = taskId.trim();
                if (/^\d+$/.test(trimmed)) {
                  const id = BigInt(trimmed);
                  swarmSocket.selectActiveTaskId(id);
                  void swarmSocket.refreshOnChainState(id, true, true);
                }
              }}
            />
          ) : null}
          {!liveMode ? (
            <ConsensusTimeline
              rounds={demo.rounds}
              activeIndex={displayedRoundIndex}
              onSelect={selectRound}
              isAutoplaying={isAutoplaying}
              onPlay={() => runDemo(activeRound)}
              onPause={pauseDemo}
            />
          ) : null}
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <section className="border border-white/10 bg-panel/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Network Dashboard</h2>
              <span className="text-[10px] uppercase tracking-[0.2em] text-acid">
                {liveMode ? "live on-chain" : "off-chain execution"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <InfoTile label="Task propagation" value={swarmSocket.metrics.activeTasks > 0 || displayedRoundIndex > 0 ? "in-flight" : "standby"} tone="pulse" />
              <InfoTile label="Consensus state" value={round.state} tone={round.state === "slashing" ? "flare" : "acid"} />
              <InfoTile label="Malicious detection" value={round.slashedNodeIds.length ? "proven" : displayedRoundIndex >= 5 ? "challenged" : "watching"} tone="flare" />
              <InfoTile label="Settlement layer" value={liveMode ? "Devnet" : "Solana"} tone="pulse" />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="min-w-0 border border-white/10 bg-black/20 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">Adversarial output agreement</div>
                <div className="thin-scrollbar grid max-h-[260px] gap-2 overflow-auto pr-1">
                  {round.outputs.length === 0 ? (
                    <div className="text-sm text-white/45">Waiting for executors to return independent digests.</div>
                  ) : (
                    round.outputs.map((output) => (
                      <div
                        key={output.nodeId}
                        className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto] items-center gap-3 border px-3 py-2 text-xs ${output.malicious ? "border-flare/40 bg-flare/[0.08]" : "border-acid/25 bg-acid/[0.06]"
                          }`}
                      >
                        <span className="truncate text-white/70">{output.nodeId}</span>
                        <span className="truncate font-mono text-white">{output.digest}</span>
                        <span className={output.malicious ? "text-flare" : "text-acid"}>{output.confidence}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="min-w-0 border border-white/10 bg-black/20 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">Current market event</div>
                <h3 className="text-xl font-bold text-white">{round.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/58">{round.description}</p>
                <div className="mt-4 border border-pulse/20 bg-pulse/[0.06] p-3 text-xs leading-5 text-pulse">
                  Correctness is a market: execution, validation, challenge proof, reputation, and slashing all affect settlement.
                </div>
              </div>
            </div>
          </section>

          <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px]">
            <div className="grid min-w-0 content-start gap-4">
              <ProofPanel
                activeTaskId={displayedTaskId}
                taskState={swarmSocket.onChainTaskState}
                lastTxSignature={swarmSocket.lastTxSignature}
              />
              <RewardFlow
                round={{
                  ...round,
                  verifiedDigest: liveMode && swarmSocket.onChainResult ? swarmSocket.onChainResult : round.verifiedDigest
                }}
                rewardPool={task.rewardPool}
              />
              <ReceiptPanel receipts={swarmSocket.receipts} />
            </div>
            <div className="grid min-w-0 content-start gap-4">
              <NetworkMetricsPanel metrics={swarmSocket.metrics} connected={swarmSocket.connected} />
              <TaskLifecyclePanel tasks={swarmSocket.tasks} />
              <ReputationStrip reputation={swarmSocket.reputation} />
            </div>
            <div className="grid min-w-0 content-start gap-4">
              <NodeMonitor nodes={liveNodes} assignedNodeIds={assignedNodeIds} />
              <LiveEventFeed logs={swarmSocket.logs} />
            </div>
          </div>
        </div>
      </div>
      <WhyThisMatters />
      <SolanaArchitecture />
      <footer className="border-t border-white/10 bg-black/40 py-4 text-center text-xs uppercase tracking-[0.25em] text-white/40">
        ayan · uswa 
      </footer>
    </main>
  );
}

function buildLiveRound({
  task,
  taskId,
  claims,
  taskState,
  canonicalResult
}: {
  task: YeetTaskInput;
  taskId: string | null;
  claims: OnChainClaim[];
  taskState: OnChainTaskState | null;
  canonicalResult: string | null;
}): ConsensusRound {
  const outputs = claims.map((claim): ExecutionOutput => {
    const digest = `0x${Buffer.from(claim.resultHash).toString("hex")}`;
    const resolved = taskState?.state === 1;
    const canonical = taskState ? canonicalResultHex(taskState) : null;
    const malicious = Boolean(
      resolved &&
        canonical &&
        (digest !== canonical || claim.confidence < (taskState?.verificationThreshold ?? task.verificationThreshold))
    );

    return {
      nodeId: claim.node.toBase58(),
      role: claim.role === 0 ? "executor" : claim.role === 1 ? "validator" : "challenger",
      digest,
      confidence: claim.confidence,
      malicious,
      latencyMs: 0
    };
  });

  const slashedNodeIds = outputs.filter((output) => output.malicious).map((output) => output.nodeId);
  const rewardEvents = buildLiveRewardEvents(outputs, task, taskState);
  const minClaims = taskState?.difficulty ?? task.difficulty;
  const claimCount = taskState?.claimCount ?? claims.length;
  const idLabel = taskId ? `#${taskId}` : "pending task";

  if (taskState?.state === 1) {
    return {
      state: slashedNodeIds.length > 0 ? "slashing" : "resolved",
      title: slashedNodeIds.length > 0 ? "Canonical truth settled with penalties" : "Canonical truth settled",
      description: `${idLabel} resolved on Solana with ${claimCount} claim${claimCount === 1 ? "" : "s"}. Canonical result and reward accounting are now sourced from the task account.`,
      outputs,
      slashedNodeIds,
      rewardEvents,
      verifiedDigest: canonicalResult ?? canonicalResultHex(taskState)
    };
  }

  if (claims.length > 0) {
    return {
      state: claims.length >= minClaims ? "validating" : "executing",
      title: claims.length >= minClaims ? "Claims ready for resolution" : "Claims arriving on-chain",
      description: `${idLabel} has ${claims.length}/${minClaims} required claim${minClaims === 1 ? "" : "s"}. Submit enough node receipts, then resolve to settle the canonical result.`,
      outputs,
      slashedNodeIds: [],
      rewardEvents: [],
      verifiedDigest: undefined
    };
  }

  return {
    state: taskId ? "queued" : "forming",
    title: taskId ? "Task opened on Solana" : "Live task not created yet",
    description: taskId
      ? `${idLabel} is open with ${task.rewardPool} UI reward unit${task.rewardPool === 1 ? "" : "s"}, difficulty ${task.difficulty}, and redundancy ${task.redundancyFactor}.`
      : "Connect Phantom and create an on-chain task to populate live settlement state.",
    outputs: [],
    slashedNodeIds: [],
    rewardEvents: [],
    verifiedDigest: undefined
  };
}

function buildLiveRewardEvents(
  outputs: ExecutionOutput[],
  task: YeetTaskInput,
  taskState: OnChainTaskState | null
): RewardEvent[] {
  if (taskState?.state !== 1) return [];

  const winners = outputs.filter((output) => !output.malicious);
  const losers = outputs.filter((output) => output.malicious);
  const rewardShare = winners.length > 0 ? Number((task.rewardPool / winners.length).toFixed(3)) : 0;

  return [
    ...winners.map((output) => ({
      nodeId: output.nodeId,
      label: output.nodeId.slice(0, 8),
      delta: rewardShare,
      reason: output.role === "challenger" ? "challenge-backed canonical claim" : "matched canonical result"
    })),
    ...losers.map((output) => ({
      nodeId: output.nodeId,
      label: output.nodeId.slice(0, 8),
      delta: -Math.max(1, Math.round(task.rewardPool * 0.2)),
      reason: "losing or low-confidence claim"
    }))
  ];
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
