const { WebSocketServer } = require("ws");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createNodeIdentity, digestFor, signReceipt, verifyReceipt } = require("./receipt-crypto");
const { applyReceipt, applySlash, ensureReputation, readReputation, writeReputation } = require("./reputation-store");

const PORT = Number(process.env.YEET_COORDINATOR_PORT ?? 8787);
const logPath = path.join(process.cwd(), "logs", "sample-swarm.log");

const roleCycle = ["executor", "validator", "challenger", "hybrid"];
const aliases = ["VANTA", "KITE", "MORSE", "ION", "NOVA", "HALO", "CIPHER", "AXON"];
const clients = new Set();
const workerSockets = new Map();
const nodeKeys = new Map();
let reputation = readReputation();
let nodes = createSeedNodes();
let tasks = [];
let receipts = [];
let assignedNodeIds = [];
let currentRound = null;
let heartbeatCount = 0;
let invalidReceipts = 0;

const httpServer = http.createServer();
httpServer.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[EADDRINUSE] Port ${PORT} is already in use.\n` +
        `  Free it: kill $(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null)\n` +
        `  Or use another port: YEET_COORDINATOR_PORT=8788 npm run coord:dev\n` +
        `  Match the app: NEXT_PUBLIC_YEET_COORDINATOR_WS=ws://localhost:8788 npm run dev`
    );
    process.exit(1);
  }
  throw err;
});

const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(PORT, () => {
  log("success", `YEET coordination websocket listening on ws://localhost:${PORT}`);
});

wss.on("connection", (socket) => {
  clients.add(socket);
  send(socket, "snapshot", snapshot());

  socket.on("message", (raw) => {
    const message = parse(raw);
    if (!message) return;
    if (message.type === "dispatch_task") dispatchTask(message.payload);
    if (message.type === "register_worker") registerWorker(socket, message.payload);
    if (message.type === "worker_heartbeat") receiveHeartbeat(message.payload.nodeId);
    if (message.type === "worker_receipt") receiveExternalReceipt(message.payload);
  });

  socket.on("close", () => {
    clients.delete(socket);
    for (const [nodeId, worker] of workerSockets.entries()) {
      if (worker === socket) {
        workerSockets.delete(nodeId);
        log("warn", `${nodeId} disconnected from coordinator`);
      }
    }
    broadcast("metrics", metrics());
  });
});

setInterval(() => {
  nodes = nodes.map((node) => ({ ...node, uptimeScore: Math.min(100, node.uptimeScore + 1), status: node.status === "idle" ? "bidding" : node.status }));
  heartbeatCount += nodes.length;
  broadcast("nodes", nodes);
  broadcast("metrics", metrics());
}, 4500);

function dispatchTask(input) {
  const task = {
    id: `task-${Date.now()}`,
    name: input.name,
    type: input.type,
    status: "queued",
    rewardPool: Number(input.rewardPool ?? 1200),
    participantIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    difficulty: Number(input.difficulty ?? 7),
    redundancyFactor: Number(input.redundancyFactor ?? 5),
    verificationThreshold: Number(input.verificationThreshold ?? 72)
  };
  tasks = [task, ...tasks].slice(0, 12);
  receipts = [];
  assignedNodeIds = [];
  emitRound("queued", "Task queued", "Reward escrow and task metadata enter the coordination market.", []);
  broadcastState("tasks");
  log("info", `${task.id} queued with ${task.rewardPool} YEET reward pool`);

  setTimeout(() => formSwarm(task), 700);
}

function formSwarm(task) {
  const selected = [...nodes]
    .sort((a, b) => b.reliabilityScore + b.stake / 8 + b.hardware.gpuScore - (a.reliabilityScore + a.stake / 8 + a.hardware.gpuScore))
    .slice(0, Math.max(task.redundancyFactor + 2, 7));
  assignedNodeIds = selected.map((node) => node.id);
  task.status = "active";
  task.participantIds = assignedNodeIds;
  task.updatedAt = Date.now();
  nodes = nodes.map((node) => assignedNodeIds.includes(node.id) ? { ...node, status: "assigned" } : node);
  emitRound("forming", "Ephemeral swarm formation", "Nodes bid with stake, reputation, and hardware profile. A temporary off-chain swarm forms.", []);
  broadcastState("nodes");
  broadcastState("tasks");
  log("success", `${task.id} assigned to ${assignedNodeIds.length} nodes`);

  setTimeout(() => {
    emitRound("assigned", "Node assignment", "Executors, validators, and challenger receive assignment and heartbeat tracking begins.", []);
    executeTask(task, selected);
  }, 900);
}

function executeTask(task, selected) {
  nodes = nodes.map((node) => assignedNodeIds.includes(node.id) ? { ...node, status: "executing" } : node);
  emitRound("executing", "Redundant execution", "Independent nodes execute the task with simulated latency and malicious divergence.", []);
  broadcastState("nodes");
  for (const [nodeId, worker] of workerSockets.entries()) {
    send(worker, "execute_task", { ...task, assigned: assignedNodeIds.includes(nodeId) });
  }

  const malicious = selected[3];
  const truthDigest = `0x${digestFor(task, "truth")}`;
  const fraudDigest = `0x${digestFor(task, "malicious")}`;
  const outputs = selected.slice(0, task.redundancyFactor).map((node, index) => {
    const role = index < 3 ? "executor" : "validator";
    const digest = node.id === malicious.id ? fraudDigest : truthDigest;
    return buildReceipt(task, node, role, digest, node.id === malicious.id, 650 + index * 170);
  });

  setTimeout(() => {
    receipts = outputs.map((output) => output.receipt);
    receipts.forEach((receipt) => applyReceipt(reputation, receipt));
    writeReputation(reputation);
    emitRound("receipts", "Signed receipts", "Each output digest carries an ed25519 execution receipt verified by the coordinator.", outputs);
    broadcastState("receipts");
    broadcastState("reputation");
    log("success", `${receipts.filter((receipt) => receipt.verified).length} signed receipts verified`);
  }, 1000);

  setTimeout(() => {
    nodes = nodes.map((node) => assignedNodeIds.includes(node.id) ? { ...node, status: "validating" } : node);
    emitRound("validating", "Validator comparison", "Validators compare signed digests. One receipt is validly signed but computationally fraudulent.", outputs);
    broadcastState("nodes");
    log("info", "validator set detected digest divergence");
  }, 2100);

  setTimeout(() => {
    const challenger = selected.find((node) => node.rolePreference === "challenger") ?? selected[selected.length - 1];
    nodes = nodes.map((node) => node.id === challenger.id ? { ...node, activeRole: "challenger", status: "challenging" } : node);
    emitRound("challenged", "Challenge initiated", `${challenger.alias} proves network divergence. YEET rewards nodes for proving the network wrong.`, outputs, challenger.id);
    broadcastState("nodes");
    log("warn", `${challenger.id} opened fraud challenge against ${malicious.id}`);
  }, 3200);

  setTimeout(() => {
    applySlash(reputation, malicious.id);
    writeReputation(reputation);
    nodes = nodes.map((node) => node.id === malicious.id ? { ...node, status: "slashed", stake: Math.round(node.stake * 0.72), fraudHistory: node.fraudHistory + 1 } : node);
    emitRound("slashing", "Fraud proven", `${malicious.alias} loses stake. Mock Solana settlement record generated.`, outputs, undefined, [malicious.id], [{ nodeId: malicious.id, label: malicious.alias, delta: -Math.round(malicious.stake * 0.28), reason: "fraudulent compute digest" }]);
    broadcastState("nodes");
    broadcastState("reputation");
    log("danger", `${malicious.id} slashed for fraudulent digest`);
  }, 4300);

  setTimeout(() => {
    const rewardEvents = selected
      .filter((node) => node.id !== malicious.id)
      .slice(0, 6)
      .map((node, index) => ({
        nodeId: node.id,
        label: node.alias,
        delta: index === 2 ? 240 : 130 + index * 22,
        reason: index === 2 ? "minority challenge reward" : "correctness contribution"
      }));
    task.status = "completed";
    task.updatedAt = Date.now();
    nodes = nodes.map((node) => assignedNodeIds.includes(node.id) && node.id !== malicious.id ? { ...node, status: "rewarded", rewardsEarned: node.rewardsEarned + 100 } : node);
    emitRound("resolved", "Verified result returned", "Rewards settle by execution, validation, challenge proof, and reputation.", outputs, undefined, [malicious.id], rewardEvents, truthDigest);
    broadcastState("nodes");
    broadcastState("tasks");
    log("success", `${task.id} resolved with verified digest ${truthDigest}`);
  }, 5400);
}

function buildReceipt(task, node, role, digest, malicious, latencyMs) {
  const keys = nodeKeys.get(node.id);
  const unsigned = {
    receiptId: `rcpt-${task.id}-${node.id}`,
    taskId: task.id,
    nodeId: node.id,
    digest,
    role,
    issuedAt: Date.now(),
    publicKey: keys.publicKeyPem
  };
  const signed = signReceipt(unsigned, keys.privateKeyPem);
  const receipt = {
    ...signed,
    verified: verifyReceipt(signed)
  };
  if (!receipt.verified) invalidReceipts += 1;
  return {
    nodeId: node.id,
    role,
    digest,
    confidence: malicious ? 38 : 86,
    malicious,
    latencyMs,
    receipt
  };
}

function registerWorker(socket, payload) {
  const nodeId = payload.nodeId ?? `worker-${Date.now()}`;
  const keys = createNodeIdentity();
  nodeKeys.set(nodeId, keys);
  workerSockets.set(nodeId, socket);
  ensureReputation(reputation, nodeId);
  nodes = upsertNode({
    id: nodeId,
    alias: payload.alias ?? nodeId.toUpperCase(),
    hardware: payload.hardware ?? { label: "local docker worker", gpuScore: 64, vramGb: 8, ramGb: 16 },
    uptimeScore: 80,
    reliabilityScore: payload.malicious ? 42 : 82,
    stake: payload.malicious ? 160 : 260,
    rolePreference: payload.rolePreference ?? "hybrid",
    activeRole: payload.rolePreference ?? "hybrid",
    status: "idle",
    rewardsEarned: 0,
    fraudHistory: payload.malicious ? 1 : 0,
    x: 12 + Math.random() * 76,
    y: 12 + Math.random() * 76
  });
  send(socket, "worker_registered", { nodeId, publicKey: keys.publicKeyPem });
  broadcastState("nodes");
  broadcastState("reputation");
  log(payload.malicious ? "warn" : "success", `${nodeId} registered as ${payload.malicious ? "malicious" : "honest"} worker`);
}

function receiveHeartbeat(nodeId) {
  heartbeatCount += 1;
  const entry = ensureReputation(reputation, nodeId);
  entry.lastSeen = Date.now();
  writeReputation(reputation);
}

function receiveExternalReceipt(receipt) {
  const verified = verifyReceipt(receipt);
  const stored = { ...receipt, verified };
  receipts = [stored, ...receipts].slice(0, 24);
  applyReceipt(reputation, stored);
  writeReputation(reputation);
  broadcastState("receipts");
  broadcastState("reputation");
  log(verified ? "success" : "danger", `${receipt.nodeId} submitted ${verified ? "verified" : "invalid"} external receipt`);
}

function emitRound(state, title, description, outputs, challengerId, slashedNodeIds = [], rewardEvents = [], verifiedDigest) {
  currentRound = { state, title, description, outputs, challengerId, slashedNodeIds, rewardEvents, verifiedDigest };
  broadcast("round", currentRound);
  broadcast("metrics", metrics());
}

function broadcastState(kind) {
  if (kind === "nodes") broadcast("nodes", nodes);
  if (kind === "tasks") broadcast("tasks", tasks);
  if (kind === "receipts") broadcast("receipts", receipts);
  if (kind === "reputation") broadcast("reputation", Object.values(reputation));
  broadcast("metrics", metrics());
}

function snapshot() {
  return {
    connected: true,
    nodes,
    assignedNodeIds,
    currentRound,
    receipts,
    reputation: Object.values(reputation),
    tasks,
    logs: readSampleLogs(),
    metrics: metrics()
  };
}

function metrics() {
  return {
    connectedNodes: nodes.length,
    heartbeatsPerMinute: heartbeatCount,
    receiptsVerified: receipts.filter((receipt) => receipt.verified).length,
    invalidReceipts,
    queuedTasks: tasks.filter((task) => task.status === "queued").length,
    activeTasks: tasks.filter((task) => task.status === "active").length,
    completedTasks: tasks.filter((task) => task.status === "completed").length,
    slashedNodes: Object.values(reputation).filter((entry) => entry.slashCount > 0).length
  };
}

function createSeedNodes() {
  return aliases.map((alias, index) => {
    const id = `node-${String(index + 1).padStart(2, "0")}`;
    nodeKeys.set(id, createNodeIdentity());
    ensureReputation(reputation, id);
    const angle = (index / aliases.length) * Math.PI * 2;
    return {
      id,
      alias,
      hardware: { label: index % 3 === 0 ? "RTX 4090 local rig" : "consumer GPU worker", gpuScore: 62 + index * 4, vramGb: 8 + (index % 4) * 4, ramGb: 16 + (index % 3) * 16 },
      uptimeScore: 74 + index * 2,
      reliabilityScore: 70 + index * 3,
      stake: 180 + index * 38,
      rolePreference: roleCycle[index % roleCycle.length],
      activeRole: roleCycle[index % roleCycle.length],
      status: index % 3 === 0 ? "bidding" : "idle",
      rewardsEarned: 30 + index * 8,
      fraudHistory: index === 3 ? 1 : 0,
      x: 50 + Math.cos(angle) * (34 + (index % 3) * 8),
      y: 50 + Math.sin(angle) * (34 + (index % 3) * 8)
    };
  });
}

function upsertNode(node) {
  const rest = nodes.filter((candidate) => candidate.id !== node.id);
  return [node, ...rest].slice(0, 16);
}

function send(socket, type, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type, payload }));
}

function broadcast(type, payload) {
  for (const client of clients) send(client, type, payload);
}

function log(level, message) {
  const entry = { id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`, ts: Date.now(), level, message };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date(entry.ts).toISOString()} ${level.toUpperCase()} ${message}\n`);
  broadcast("log", entry);
}

function readSampleLogs() {
  try {
    return fs.readFileSync(logPath, "utf8").trim().split("\n").slice(-20).reverse().map((line, index) => ({
      id: `seed-log-${index}`,
      ts: Date.now() - index * 1000,
      level: line.includes("DANGER") ? "danger" : line.includes("WARN") ? "warn" : line.includes("SUCCESS") ? "success" : "info",
      message: line.replace(/^\S+\s+\S+\s+/, "")
    }));
  } catch {
    return [];
  }
}

function parse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}
