import { PublicKey } from "@solana/web3.js";

export const YEET_PROGRAM_ID = new PublicKey("Yeet111111111111111111111111111111111111111");

export function deriveNodeProfilePda(operator: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("node"), operator.toBuffer()], YEET_PROGRAM_ID);
}

export function deriveTaskEscrowPda(requester: PublicKey, taskNonce: bigint | number) {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(taskNonce));
  return PublicKey.findProgramAddressSync([Buffer.from("task"), requester.toBuffer(), nonceBuffer], YEET_PROGRAM_ID);
}
