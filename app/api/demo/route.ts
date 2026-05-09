import { NextResponse } from "next/server";
import { buildDemoSwarm } from "@/app/lib/yeetSimulation";

export async function GET() {
  return NextResponse.json({
    pitch: "YEET rewards nodes for proving the network wrong.",
    positioning:
      "A Solana-native adversarial compute coordination protocol for off-chain execution and on-chain accountability.",
    flow: [
      "Idle consumer hardware exists",
      "User yeets a compute task",
      "Temporary off-chain swarm forms",
      "Redundant execution begins",
      "One malicious node submits a divergent digest",
      "Validators compare outputs",
      "Challenger proves network divergence",
      "Slashing and reputation update would settle on Solana",
      "Rewards distribute by correctness contribution",
      "Verified result returned"
    ],
    demo: buildDemoSwarm()
  });
}
