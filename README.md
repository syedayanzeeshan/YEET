# YEET

Yielding Ephemeral Execution Topology

YEET rewards nodes for proving the network wrong.

This repo is a Solana Frontier hackathon MVP for an adversarial compute coordination protocol. It now includes a polished frontend, a lightweight websocket coordination layer, signed execution receipts, persistent local reputation, dockerized worker simulation, and a Solana/Anchor architecture scaffold.

## Demo Flow

1. Idle consumer nodes exist in the mock network.
2. A user yeets a task with reward, redundancy, difficulty, threshold, and timeout.
3. The app forms an ephemeral off-chain swarm from reliability, hardware, stake, and task fit.
4. Redundant executors return output digests.
5. One malicious node submits a divergent digest.
6. Validators compare outputs.
7. A challenger disputes the suspicious result.
8. Fraud is proven, stake is slashed, and reputation would update.
9. Rewards distribute by correctness contribution.
10. The verified result is returned to the user.

## Folder Structure

```txt
anchor/
  programs/yeet_coordination/  Anchor program scaffold
  app/src/                     PDA and transaction payload examples
app/
  api/
    demo/route.ts          Demo scenario API
    nodes/route.ts         Mock node registry API
    tasks/route.ts         Task yeeting API
  components/              Animated UI sections
  lib/yeetSimulation.ts    Swarm formation, consensus, slashing, rewards
  types/yeet.ts            Shared domain types
  page.tsx                 Demo UI
contracts/
  YeetSwarm.sol            Initial economic logic prototype
data/
  reputation.json           Local persistent reputation store
docs/
  architecture.md          Solana-native protocol architecture
  demo.md                  (optional local copy; excluded from Git — demo / video scripts)
logs/
  sample-swarm.log          Example coordinator event stream
server/
  coordination-server.js    Websocket coordinator
  receipt-crypto.js         ed25519 receipt signing helpers
  reputation-store.js       Local reputation persistence
scripts/
  start-swarm.js            Start websocket coordinator
  spawn-malicious-node.js   Spawn a malicious local worker
  dispatch-task.js          Dispatch a task through websocket
workers/
  worker.js                 Docker/local worker process
```

## Troubleshooting

**`EADDRINUSE` on port 8787:** Another coordinator (or stray process) is still bound to the WebSocket port. Stop it, for example:

```bash
kill $(lsof -t -iTCP:8787 -sTCP:LISTEN)
```

Or run on another port (`YEET_COORDINATOR_PORT=8788 npm run coord:dev`) and set `NEXT_PUBLIC_YEET_COORDINATOR_WS=ws://localhost:8788` before `npm run dev` so the UI matches.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and press `YEET TASK`.

## Semi-Functional Swarm Demo

Run the websocket coordinator in one terminal:

```bash
npm run coord:dev
```

Run the frontend in another:

```bash
npm run dev
```

Dispatch a task from the CLI:

```bash
npm run swarm:dispatch -- "receipt verification pulse"
```

Spawn an extra malicious worker:

```bash
npm run swarm:malicious
```

The frontend connects to `ws://localhost:8787`. If the coordinator is not running, the app falls back to the local deterministic simulation so the demo remains stable.

## Docker Worker Simulation

Workers register with the coordinator, heartbeat, simulate latency, and submit signed ed25519 receipts. The malicious worker deliberately generates divergent output.

**If `docker compose` is not available** (for example the Compose V2 plugin is not installed), use plain Docker:

```bash
npm run docker:workers
```

**With Docker Compose V2** (subcommand `docker compose`, not the legacy `docker-compose` hyphen binary):

```bash
docker compose up --build
```

On Linux, ensure `host.docker.internal` resolves inside containers (Docker 20.10+ adds this when using compose defaults; the `npm run docker:workers` script passes `--add-host=host.docker.internal:host-gateway`). Start `npm run coord:dev` on the host before workers connect.

## Stack

- Next.js
- TypeScript
- Tailwind
- Framer Motion
- viem/ethers-compatible demo wallet direction
- Node.js websocket coordinator
- ed25519 signed execution receipts
- local JSON reputation persistence
- dockerized worker simulation
- Future protocol target: Solana programs with Rust + Anchor
- Solidity contract retained as an economic prototype

## Architecture Notes

The coordinator handles demo-time node registration, heartbeat tracking, task assignment, receipt streaming, malicious divergence, slashing events, reward events, and reputation updates. Solana is represented as the future settlement layer: Anchor programs would own node profile PDAs, task escrow accounts, staking vaults, slashing, reward distribution, and reputation state.

The current system is intentionally semi-functional, not fake production infrastructure:

- execution is simulated
- websocket coordination is local
- P2P networking is not implemented
- Anchor code is a scaffold
- wallet settlement is a placeholder
- reputation persists locally in `data/reputation.json`

## Future Work

- Replace local coordinator trust with signed node agents and replicated coordination.
- Implement real Anchor instructions for node profiles, task escrow, staking, slashing, and rewards.
- Add deterministic task adapters for verifiable inference and hashing workloads.
- Introduce challenge evidence formats and optional zk proof adapters.
- Build a Sybil-aware reputation graph using compressed state.
- Expand docker workers into real node binaries with hardware telemetry.

## Design Principle

YEET is not decentralized AWS, a generic GPU marketplace, or a token speculation dashboard. The product center is a correctness market: executors compute, validators compare, challengers find fraud, and Solana becomes the future settlement layer for economically verified execution.
