const { WebSocket } = require("ws");

const coordinator = process.env.YEET_COORDINATOR_URL ?? "ws://localhost:8787";
const socket = new WebSocket(coordinator);

socket.on("open", () => {
  socket.send(JSON.stringify({
    type: "dispatch_task",
    payload: {
      name: process.argv.slice(2).join(" ") || "CLI correctness market pulse",
      type: "matrix",
      rewardPool: 1500,
      redundancyFactor: 5,
      difficulty: 7,
      verificationThreshold: 76,
      executionTimeout: 18
    }
  }));
  setTimeout(() => socket.close(), 500);
});

socket.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
