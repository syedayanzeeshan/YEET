const { spawn } = require("child_process");

const server = spawn("node", ["server/coordination-server.js"], {
  stdio: "inherit",
  env: { ...process.env, YEET_COORDINATOR_PORT: process.env.YEET_COORDINATOR_PORT ?? "8787" }
});

process.on("SIGINT", () => {
  server.kill("SIGINT");
  process.exit(0);
});
