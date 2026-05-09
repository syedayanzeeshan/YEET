"use client";

import { SendHorizontal } from "lucide-react";
import { YeetTaskInput, TaskType } from "@/app/types/yeet";
import { taskLabels } from "@/app/lib/yeetSimulation";

type Props = {
  task: YeetTaskInput;
  setTask: (task: YeetTaskInput) => void;
  onYeet: () => void;
};

export function TaskSubmissionPanel({ task, setTask, onYeet }: Props) {
  const update = <K extends keyof YeetTaskInput>(key: K, value: YeetTaskInput[K]) => {
    setTask({ ...task, [key]: value });
  };

  return (
    <section className="border border-white/10 bg-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.22em] text-white/80">Task Submission</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-acid">off-chain payload</span>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 text-xs text-white/60">
          Task name
          <input
            className="border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
            value={task.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-xs text-white/60">
          Task type
          <select
            className="border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
            value={task.type}
            onChange={(event) => update("type", event.target.value as TaskType)}
          >
            {Object.entries(taskLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Reward pool" value={task.rewardPool} min={100} max={10000} onChange={(value) => update("rewardPool", value)} />
          <NumberField label="Redundancy" value={task.redundancyFactor} min={3} max={8} onChange={(value) => update("redundancyFactor", value)} />
          <NumberField label="Difficulty" value={task.difficulty} min={1} max={10} onChange={(value) => update("difficulty", value)} />
          <NumberField label="Timeout sec" value={task.executionTimeout} min={5} max={60} onChange={(value) => update("executionTimeout", value)} />
        </div>

        <label className="grid gap-2 text-xs text-white/60">
          Verification threshold: {task.verificationThreshold}%
          <input
            type="range"
            min={40}
            max={95}
            value={task.verificationThreshold}
            onChange={(event) => update("verificationThreshold", Number(event.target.value))}
            className="accent-pulse"
          />
        </label>

        <button
          onClick={onYeet}
          className="mt-2 inline-flex h-12 items-center justify-center gap-2 border border-acid/40 bg-acid/15 text-sm font-bold uppercase tracking-[0.22em] text-acid shadow-acid transition hover:bg-acid/25"
          type="button"
        >
          <SendHorizontal size={18} />
          YEET TASK
        </button>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-white/60">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-pulse"
      />
    </label>
  );
}
