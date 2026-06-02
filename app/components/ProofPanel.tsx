"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { liveProofArtifacts, proofArtifacts, solanaProofConfig } from "@/app/lib/solanaProof";
import { canonicalResultHex, type OnChainTaskState } from "@/app/lib/solana/yeetProgram";

type Props = {
  activeTaskId?: string | null;
  taskState?: OnChainTaskState | null;
  lastTxSignature?: string | null;
  walletPublicKey?: string | null;
};

export function ProofPanel({
  activeTaskId = null,
  taskState = null,
  lastTxSignature = null,
  walletPublicKey = null,
}: Props) {
  const staticArtifacts = proofArtifacts();
  const dynamicArtifacts = liveProofArtifacts({
    activeTaskId,
    lastTxSignature,
    walletPublicKey,
    resolvedTaskId: taskState?.state === 1 ? activeTaskId : null,
  });

  // Live canonical result goes at the top if resolved
  const canonicalArtifact = taskState?.state === 1
    ? [{
        label: "Canonical result",
        value: canonicalResultHex(taskState),
        href: undefined as string | undefined,
        status: "ready" as const,
      }]
    : [{ label: "Canonical result", value: "Resolve task to settle on-chain", status: "pending" as const }];

  const artifacts = [...staticArtifacts, ...canonicalArtifact, ...dynamicArtifacts];
  const readyCount = artifacts.filter((a) => a.status === "ready").length;

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-acid" />
          <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">On-chain Proof</h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-pulse">{solanaProofConfig.cluster}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="border border-acid/25 bg-acid/[0.07] p-3">
          <div className="text-[9px] uppercase tracking-[0.16em] text-white/40">asset</div>
          <div className="mt-1 text-sm font-black uppercase text-acid">SOL escrow</div>
        </div>
        <div className="border border-pulse/25 bg-pulse/[0.07] p-3">
          <div className="text-[9px] uppercase tracking-[0.16em] text-white/40">artifacts</div>
          <div className="mt-1 text-sm font-black uppercase text-pulse">
            {readyCount}/{artifacts.length} ready
          </div>
        </div>
      </div>

      <div className="thin-scrollbar grid max-h-[300px] gap-2 overflow-auto pr-1">
        {artifacts.map((artifact) => (
          <ProofRow
            key={artifact.label}
            label={artifact.label}
            value={artifact.value}
            href={"href" in artifact ? artifact.href : undefined}
            ready={artifact.status === "ready"}
          />
        ))}
      </div>
    </section>
  );
}

function ProofRow({
  label,
  value,
  href,
  ready,
}: {
  label: string;
  value: string;
  href?: string;
  ready: boolean;
}) {
  const body = (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</span>
        <span
          className={
            ready
              ? "text-[10px] uppercase tracking-[0.18em] text-acid"
              : "text-[10px] uppercase tracking-[0.18em] text-amber"
          }
        >
          {ready ? "ready" : "pending"}
        </span>
      </div>
      <div className="mt-1 truncate text-xs text-white/70">{value}</div>
    </div>
  );

  if (!href) {
    return <div className="border border-white/10 bg-black/20 p-3">{body}</div>;
  }

  return (
    <a
      className="grid grid-cols-[1fr_auto] items-center gap-3 border border-white/10 bg-black/20 p-3 transition hover:border-pulse/35 hover:bg-pulse/[0.05]"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {body}
      <ExternalLink size={14} className="text-pulse" />
    </a>
  );
}
