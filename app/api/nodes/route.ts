import { NextResponse } from "next/server";
import { createMockNodes } from "@/app/lib/yeetSimulation";

export async function GET() {
  return NextResponse.json({
    nodes: createMockNodes(),
    note: "Mock idle consumer nodes. Join and leave behavior is simulated for the hackathon MVP."
  });
}
