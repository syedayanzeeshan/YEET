import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { deriveNodeProfilePda, deriveTaskEscrowPda, YEET_PROGRAM_ID } from "./pda";

export function mockRegisterNodeInstruction(operator: PublicKey, hardwareHash: Uint8Array, rolePreference: number) {
  const [nodeProfile] = deriveNodeProfilePda(operator);
  return {
    description: "Mock payload for future Anchor register_node instruction.",
    accounts: { operator, nodeProfile },
    args: { hardwareHash: Buffer.from(hardwareHash).toString("hex"), rolePreference },
    instruction: new TransactionInstruction({ programId: YEET_PROGRAM_ID, keys: [], data: Buffer.alloc(0) })
  };
}

export function mockOpenTaskInstruction(
  requester: PublicKey,
  taskNonce: bigint | number,
  rewardPool: number,
  redundancy: number,
  verificationThreshold: number,
  coordinator: PublicKey,
  metadataHash: Uint8Array
) {
  const [taskEscrow] = deriveTaskEscrowPda(requester, taskNonce);
  return {
    description: "Mock payload for Anchor open_task instruction with SOL escrow.",
    accounts: { requester, taskEscrow },
    args: {
      taskNonce: taskNonce.toString(),
      rewardPool,
      redundancy,
      verificationThreshold,
      coordinator,
      metadataHash: Buffer.from(metadataHash).toString("hex")
    },
    instruction: new TransactionInstruction({ programId: YEET_PROGRAM_ID, keys: [], data: Buffer.alloc(0) })
  };
}
