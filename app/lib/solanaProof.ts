import {
  explorerTxUrl as programExplorerTxUrl,
  explorerAccountUrl,
  YEET_PROGRAM_ID,
  SOLANA_CLUSTER,
  taskPda,
  nodePda,
  historyPda,
} from "@/app/lib/solana/yeetProgram";

export type ProofArtifact = {
  label: string;
  value: string;
  href?: string;
  status: "ready" | "pending";
};

export const solanaProofConfig = {
  cluster: SOLANA_CLUSTER,
  programId: YEET_PROGRAM_ID.toBase58(),
};

export function explorerAddressUrl(address: string) {
  return explorerAccountUrl(address);
}

export function explorerTxUrl(signature: string) {
  return programExplorerTxUrl(signature);
}

/** Static artifacts that are always ready (the program itself + deployer). */
export function proofArtifacts(): ProofArtifact[] {
  const programId = YEET_PROGRAM_ID.toBase58();
  return [
    {
      label: "Program",
      value: programId,
      href: explorerAccountUrl(programId),
      status: "ready",
    },
    {
      label: "Deployer",
      value: process.env.NEXT_PUBLIC_YEET_DEPLOYER ?? "BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ",
      href: explorerAccountUrl(
        process.env.NEXT_PUBLIC_YEET_DEPLOYER ?? "BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ"
      ),
      status: "ready",
    },
  ];
}

/**
 * Derive live proof artifacts from on-chain state that is already loaded
 * in the UI (no extra RPC calls needed here).
 */
export function liveProofArtifacts({
  activeTaskId,
  lastTxSignature,
  walletPublicKey,
  resolvedTaskId,
}: {
  activeTaskId: string | null;
  lastTxSignature: string | null;
  walletPublicKey: string | null;
  resolvedTaskId?: string | null;
}): ProofArtifact[] {
  const artifacts: ProofArtifact[] = [];

  // Task PDA — derived from active task id
  if (activeTaskId !== null) {
    try {
      const [taskAddress] = taskPda(BigInt(activeTaskId));
      const addr = taskAddress.toBase58();
      artifacts.push({
        label: "Task PDA",
        value: addr,
        href: explorerAccountUrl(addr),
        status: "ready",
      });
    } catch {
      artifacts.push({ label: "Task PDA", value: `task #${activeTaskId}`, status: "pending" });
    }
  } else {
    artifacts.push({ label: "Task PDA", value: "pending first devnet task", status: "pending" });
  }

  // Node Profile PDA — derived from connected wallet
  if (walletPublicKey) {
    try {
      const { PublicKey } = require("@solana/web3.js") as typeof import("@solana/web3.js");
      const [nodeAddress] = nodePda(new PublicKey(walletPublicKey));
      const addr = nodeAddress.toBase58();
      artifacts.push({
        label: "Node Profile PDA",
        value: addr,
        href: explorerAccountUrl(addr),
        status: "ready",
      });

      // Task History PDA
      const [historyAddress] = historyPda(new PublicKey(walletPublicKey));
      const hAddr = historyAddress.toBase58();
      artifacts.push({
        label: "Task History PDA",
        value: hAddr,
        href: explorerAccountUrl(hAddr),
        status: "ready",
      });
    } catch {
      artifacts.push({ label: "Node Profile PDA", value: "pending node registration", status: "pending" });
    }
  } else {
    artifacts.push({ label: "Node Profile PDA", value: "connect wallet to derive", status: "pending" });
  }

  // Last transaction
  if (lastTxSignature) {
    artifacts.push({
      label: "Last transaction",
      value: lastTxSignature,
      href: explorerTxUrl(lastTxSignature),
      status: "ready",
    });
  } else {
    artifacts.push({ label: "Last transaction", value: "no transaction this session", status: "pending" });
  }

  // Resolved task tx (if resolution happened)
  if (resolvedTaskId !== null && resolvedTaskId !== undefined) {
    artifacts.push({
      label: "Resolved task",
      value: `Task #${resolvedTaskId} settled on-chain`,
      status: "ready",
    });
  }

  return artifacts;
}
