const { WebSocket } = require("ws");
const { createNodeIdentity, digestFor, signReceipt } = require("../server/receipt-crypto");

const coordinator = process.env.YEET_COORDINATOR_URL ?? "ws://localhost:8787";
const malicious = process.env.MALICIOUS === "1";
const nodeId = process.env.NODE_ID ?? `worker-${malicious ? "mal" : "honest"}-${Math.floor(Math.random() * 9999)}`;
const latencyMs = Number(process.env.LATENCY_MS ?? (malicious ? 1300 : 750));
const keys = createNodeIdentity();

console.log(`[yeet-worker] ${nodeId} connecting to ${coordinator} (malicious=${malicious})`);

const socket = new WebSocket(coordinator);

socket.on("open", () => {
  console.log(`[yeet-worker] ${nodeId} registered with coordinator`);
  socket.send(JSON.stringify({
    type: "register_worker",
    payload: {
      nodeId,
      alias: nodeId.toUpperCase(),
      malicious,
      rolePreference: malicious ? "executor" : "hybrid",
      hardware: {
        label: malicious ? "spoofed local worker" : "dockerized local worker",
        gpuScore: malicious ? 41 : 72,
        vramGb: malicious ? 4 : 12,
        ramGb: malicious ? 8 : 32
      }
    }
  }));
  setInterval(() => {
    socket.send(JSON.stringify({ type: "worker_heartbeat", payload: { nodeId, ts: Date.now() } }));
  }, 2500);
});

socket.on("error", (err) => {
  console.error(`[yeet-worker] ${nodeId} websocket error:`, err.message);
});

socket.on("close", (code, reason) => {
  const why = reason?.toString() || "no reason";
  console.warn(`[yeet-worker] ${nodeId} connection closed (code ${code}): ${why}`);
});

socket.on("message", (raw) => {
  const message = parse(raw);
  if (!message) return;
  if (message.type === "execute_task") {
    execute(message.payload);
  }
});

function execute(task) {
  setTimeout(() => {
    const digest = `0x${digestFor(task, malicious ? "malicious-worker" : "truth")}`;
    const unsigned = {
      receiptId: `rcpt-${task.id}-${nodeId}`,
      taskId: task.id,
      nodeId,
      digest,
      role: malicious ? "executor" : "validator",
      issuedAt: Date.now(),
      publicKey: keys.publicKeyPem
    };
    const receipt = signReceipt(unsigned, keys.privateKeyPem);
    socket.send(JSON.stringify({ type: "worker_receipt", payload: receipt }));
  }, latencyMs);
}

function parse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}
