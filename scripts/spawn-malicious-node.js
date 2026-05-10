const { spawn } = require("child_process");

spawn("node", ["workers/worker.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    MALICIOUS: "1",
    NODE_ID: process.env.NODE_ID ?? "worker-malicious-01",
    LATENCY_MS: process.env.LATENCY_MS ?? "1200"
  }
});
