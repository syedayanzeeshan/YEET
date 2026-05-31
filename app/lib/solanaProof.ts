export type ProofArtifact = {
  label: string;
  value: string;
  href?: string;
  status: "ready" | "pending";
};

export const solanaProofConfig = {
  cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  deployer: process.env.NEXT_PUBLIC_YEET_DEPLOYER ?? "BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ",
  programId: process.env.NEXT_PUBLIC_YEET_PROGRAM_ID ?? "4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd",
  taskEscrow: process.env.NEXT_PUBLIC_YEET_TASK_ESCROW ?? "",
  nodeProfile: process.env.NEXT_PUBLIC_YEET_NODE_PROFILE ?? "",
  openTaskTx: process.env.NEXT_PUBLIC_YEET_OPEN_TASK_TX ?? "",
  settleTaskTx: process.env.NEXT_PUBLIC_YEET_SETTLE_TASK_TX ?? ""
};

export function explorerAddressUrl(address: string, cluster = solanaProofConfig.cluster) {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}

export function explorerTxUrl(signature: string, cluster = solanaProofConfig.cluster) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function proofArtifacts(): ProofArtifact[] {
  return [
    {
      label: "Program",
      value: solanaProofConfig.programId,
      href: isPlaceholderProgram(solanaProofConfig.programId) ? undefined : explorerAddressUrl(solanaProofConfig.programId),
      status: isPlaceholderProgram(solanaProofConfig.programId) ? "pending" : "ready"
    },
    {
      label: "Deployer",
      value: solanaProofConfig.deployer,
      href: explorerAddressUrl(solanaProofConfig.deployer),
      status: "ready"
    },
    {
      label: "Task PDA",
      value: solanaProofConfig.taskEscrow || "pending first devnet task",
      href: solanaProofConfig.taskEscrow ? explorerAddressUrl(solanaProofConfig.taskEscrow) : undefined,
      status: solanaProofConfig.taskEscrow ? "ready" : "pending"
    },
    {
      label: "Node PDA",
      value: solanaProofConfig.nodeProfile || "pending node registration",
      href: solanaProofConfig.nodeProfile ? explorerAddressUrl(solanaProofConfig.nodeProfile) : undefined,
      status: solanaProofConfig.nodeProfile ? "ready" : "pending"
    },
    {
      label: "Open task tx",
      value: solanaProofConfig.openTaskTx || "pending transaction",
      href: solanaProofConfig.openTaskTx ? explorerTxUrl(solanaProofConfig.openTaskTx) : undefined,
      status: solanaProofConfig.openTaskTx ? "ready" : "pending"
    },
    {
      label: "Settle task tx",
      value: solanaProofConfig.settleTaskTx || "pending transaction",
      href: solanaProofConfig.settleTaskTx ? explorerTxUrl(solanaProofConfig.settleTaskTx) : undefined,
      status: solanaProofConfig.settleTaskTx ? "ready" : "pending"
    }
  ];
}

function isPlaceholderProgram(programId: string) {
  return programId.startsWith("Yeet111") || programId.length < 32;
}
