"use client";

import { Activity, CheckCircle2, Clock3, Radio, Signature, XCircle } from "lucide-react";
import { ExecutionReceipt, MarketplaceTask, NodeReputation, SwarmLogEvent, SwarmMetrics } from "@/app/types/yeet";

export function NetworkMetricsPanel({ metrics, connected }: { metrics: SwarmMetrics; connected: boolean }) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Network Metrics</h2>
        <span className={`text-[10px] uppercase tracking-[0.2em] ${connected ? "text-acid" : "text-amber"}`}>
          {connected ? "live ws" : "local fallback"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="nodes" value={metrics.connectedNodes} tone="pulse" />
        <Metric label="hb/min" value={metrics.heartbeatsPerMinute} tone="acid" />
        <Metric label="receipts" value={metrics.receiptsVerified} tone="acid" />
        <Metric label="invalid" value={metrics.invalidReceipts} tone="flare" />
      </div>
    </section>
  );
}

export function ReceiptPanel({ receipts }: { receipts: ExecutionReceipt[] }) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Signed Receipts</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-pulse">ed25519</span>
      </div>
      <div className="thin-scrollbar grid max-h-[250px] gap-2 overflow-auto pr-1">
        {receipts.length === 0 ? (
          <div className="border border-white/10 bg-white/[0.03] p-3 text-xs text-white/45">Awaiting signed node receipts.</div>
        ) : (
          receipts.slice(0, 8).map((receipt) => (
            <div key={receipt.receiptId} className="border border-white/10 bg-black/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-white">
                  <Signature size={14} className={receipt.verified ? "text-acid" : "text-flare"} />
                  <span className="truncate">{receipt.nodeId}</span>
                </div>
                <span className={receipt.verified ? "text-acid" : "text-flare"}>{receipt.verified ? "verified" : "invalid"}</span>
              </div>
              <div className="mt-2 truncate text-white/42">{receipt.digest}</div>
              <div className="mt-1 truncate text-white/32">sig {receipt.signature.slice(0, 24)}...</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function TaskLifecyclePanel({ tasks }: { tasks: MarketplaceTask[] }) {
  const groups = {
    queued: tasks.filter((task) => task.status === "queued").length,
    active: tasks.filter((task) => task.status === "active").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    failed: tasks.filter((task) => task.status === "failed").length
  };

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Task Market</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-acid">lifecycle</span>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        <Metric label="queued" value={groups.queued} tone="amber" />
        <Metric label="active" value={groups.active} tone="pulse" />
        <Metric label="done" value={groups.completed} tone="acid" />
        <Metric label="failed" value={groups.failed} tone="flare" />
      </div>
      <div className="thin-scrollbar grid max-h-[210px] gap-2 overflow-auto pr-1">
        {tasks.slice(0, 8).map((task) => (
          <div key={task.id} className="border border-white/10 bg-black/20 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-white">{task.name}</span>
              <span className={statusClass(task.status)}>{task.status}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-white/42">
              <span>{task.rewardPool} YEET</span>
              <span>{task.participantIds.length} nodes</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LiveEventFeed({ logs }: { logs: SwarmLogEvent[] }) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Swarm Logs</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-pulse">stream</span>
      </div>
      <div className="thin-scrollbar grid max-h-[290px] gap-2 overflow-auto pr-1">
        {logs.length === 0 ? (
          <div className="border border-white/10 bg-white/[0.03] p-3 text-xs text-white/45">Waiting for coordinator events.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[18px_1fr] gap-2 border border-white/10 bg-black/20 p-2 text-xs">
              <span className={logIconClass(log.level)}>{iconFor(log.level)}</span>
              <div>
                <div className="text-white/65">{log.message}</div>
                <div className="mt-1 text-[10px] text-white/28">{new Date(log.ts).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function ReputationStrip({ reputation }: { reputation: NodeReputation[] }) {
  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Reputation State</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber">persistent</span>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {reputation.slice(0, 6).map((entry) => (
          <div key={entry.nodeId} className="border border-white/10 bg-black/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white">{entry.nodeId}</span>
              <span className={entry.maliciousFlags > 0 ? "text-flare" : "text-acid"}>{entry.reputationScore}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-white/42">
              <span>slash {entry.slashCount}</span>
              <span>valid {entry.successfulValidations}</span>
              <span>win {entry.challengeWins}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: "acid" | "pulse" | "flare" | "amber" }) {
  const classes = {
    acid: "border-acid/25 bg-acid/[0.07] text-acid",
    pulse: "border-pulse/25 bg-pulse/[0.07] text-pulse",
    flare: "border-flare/25 bg-flare/[0.07] text-flare",
    amber: "border-amber/25 bg-amber/[0.07] text-amber"
  };

  return (
    <div className={`border p-2 ${classes[tone]}`}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function statusClass(status: MarketplaceTask["status"]) {
  return {
    queued: "text-amber",
    active: "text-pulse",
    completed: "text-acid",
    failed: "text-flare"
  }[status];
}

function logIconClass(level: SwarmLogEvent["level"]) {
  return {
    info: "text-pulse",
    success: "text-acid",
    warn: "text-amber",
    danger: "text-flare"
  }[level];
}

function iconFor(level: SwarmLogEvent["level"]) {
  if (level === "success") return <CheckCircle2 size={14} />;
  if (level === "warn") return <Clock3 size={14} />;
  if (level === "danger") return <XCircle size={14} />;
  if (level === "info") return <Radio size={14} />;
  return <Activity size={14} />;
}
