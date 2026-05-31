const { spawn } = require("child_process");

const env = {
  ...process.env,
  YEET_COORDINATOR_PORT: process.env.YEET_COORDINATOR_PORT ?? "8787",
  NEXT_PUBLIC_YEET_COORDINATOR_WS: process.env.NEXT_PUBLIC_YEET_COORDINATOR_WS ?? "ws://localhost:8787"
};

const processes = [
  {
    name: "coord",
    command: "node",
    args: ["server/coordination-server.js"]
  },
  {
    name: "web",
    command: "npm",
    args: ["run", "dev"]
  }
];

const children = processes.map((entry) => {
  const child = spawn(entry.command, entry.args, {
    stdio: "inherit",
    env
  });

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[yeet-demo] ${entry.name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
});

console.log("\n[yeet-demo] Coordinator: ws://localhost:8787");
console.log("[yeet-demo] Website:     http://localhost:3000");
console.log("[yeet-demo] Use the website buttons to arm workers, run the flow, and reset the stage.\n");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function shutdown(code) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGINT");
  }
  process.exit(code);
}
