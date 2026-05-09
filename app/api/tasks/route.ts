import { NextResponse } from "next/server";
import { buildDemoSwarm, defaultTask } from "@/app/lib/yeetSimulation";
import { YeetTaskInput } from "@/app/types/yeet";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => defaultTask)) as Partial<YeetTaskInput>;
  const task: YeetTaskInput = {
    ...defaultTask,
    ...body,
    rewardPool: Number(body.rewardPool ?? defaultTask.rewardPool),
    redundancyFactor: Number(body.redundancyFactor ?? defaultTask.redundancyFactor),
    difficulty: Number(body.difficulty ?? defaultTask.difficulty),
    verificationThreshold: Number(body.verificationThreshold ?? defaultTask.verificationThreshold),
    executionTimeout: Number(body.executionTimeout ?? defaultTask.executionTimeout)
  };

  return NextResponse.json(buildDemoSwarm(task));
}
