const { spawn } = require("child_process");

console.log(
  "Starting malicious worker (connects to YEET_COORDINATOR_URL, default ws://localhost:8787).\n" +
    "If nothing happens, start the coordinator first: npm run coord:dev"
);

spawn("node", ["workers/worker.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    MALICIOUS: "1",
    NODE_ID: process.env.NODE_ID ?? "worker-malicious-01",
    LATENCY_MS: process.env.LATENCY_MS ?? "1200"
  }
});
