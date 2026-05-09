# YEET

Yielding Ephemeral Execution Topology

YEET rewards nodes for proving the network wrong.

This repo is a Solana Frontier hackathon MVP for an adversarial compute coordination protocol. It simulates networking, execution, swarm formation, and consensus scoring while framing Solana as the future economic verification and settlement layer.

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
docs/
  architecture.md          Solana-native protocol architecture
  demo.md                  Solana Frontier demo order and talk track
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and press `YEET TASK`.

## Stack

- Next.js
- TypeScript
- Tailwind
- Framer Motion
- viem/ethers-compatible demo wallet direction
- Future protocol target: Solana programs with Rust + Anchor
- Solidity contract retained as an economic prototype

## Design Principle

YEET is not decentralized AWS, a generic GPU marketplace, or a token speculation dashboard. The product center is a correctness market: executors compute, validators compare, challengers find fraud, and Solana becomes the future settlement layer for economically verified execution.
