# YEET Solana Architecture

Yielding Ephemeral Execution Topology

YEET is a Solana-native adversarial compute coordination protocol prototype. The current MVP is a polished simulation: execution, swarm formation, consensus scoring, and reward distribution are mocked so the mechanism can be demonstrated quickly. The protocol direction is clear: off-chain compute execution with on-chain accountability, staking, slashing, rewards, and reputation settled by Solana programs.

Core sentence:

> YEET rewards nodes for proving the network wrong.

## What YEET Is Now

YEET is not a cloud marketplace with crypto payments attached. It is a correctness market for temporary compute swarms.

The protocol coordinates idle consumer hardware into ephemeral execution groups. Nodes can execute, validate, or challenge task outputs. Honest execution earns rewards. Correct validation earns rewards. Fraud detection earns larger rewards. Fraudulent computation loses stake and reputation.

The Solana thesis is simple: if compute happens off-chain, accountability still needs a fast, cheap, programmable settlement layer. Solana is a strong fit for high-frequency reward events, slashing events, and reputation updates.

## Why Solana

YEET needs a settlement layer that can handle many small economic events without making verification rewards too expensive to claim.

Solana is useful for:

- low-fee micro-settlements for executors, validators, and challengers
- high-throughput coordination across many independent task swarms
- PDA-based node identity and task escrow state
- program-owned staking, slashing, and reward vaults
- reputation state updates after each verified task
- parallel execution compatibility because separate swarms can settle through independent accounts
- Anchor-based development for a realistic hackathon-to-protocol migration path

The MVP does not claim to be fully decentralized today. It demonstrates the economic loop and the interface. The future Solana version moves the accounting and reputation layer into Rust + Anchor programs.

## Why Adversarial Validation Matters

Distributed compute has a harder problem than finding machines: knowing whether the machines returned correct work.

Naive redundancy can fail when validators copy the majority, colluding nodes coordinate, or low-quality nodes attempt to extract rewards without doing honest work. YEET treats disagreement as a first-class signal. A challenger is not a nuisance; it is an economically useful role.

The important mechanism is minority correctness:

- the majority can be wrong
- a challenger can dispute the majority
- fraud proof earns a bonus
- incorrect nodes lose stake
- reputation changes future selection

That is why YEET is a correctness market rather than a simple vote.

## Why Correctness Markets Matter

AI infrastructure is becoming more centralized. GPU prices are high, cloud access is expensive, and small developers are often priced out of serious experimentation. Consumer hardware has latent capacity, but decentralized compute only becomes credible when execution can be economically verified.

YEET enables:

- distributed access to temporary compute capacity
- consumer participation in AI infrastructure
- incentive-driven verification
- adversarial consensus over outputs
- off-chain execution without off-chain impunity
- settlement and accountability without relying on centralized hyperscalers

The system is intentionally not a fake training cluster. Demo workloads are simulated matrix, hashing, image, rendering, and lightweight inference tasks. The goal is to prove the coordination and incentive model first.

## Current MVP Architecture

The current app is a Next.js + TypeScript demo with:

- animated swarm visualization
- task yeeting and swarm formation
- websocket coordinator for live node events
- simulated worker registration and heartbeat messages
- ed25519 signed execution receipts
- persistent local reputation tracking
- marketplace-style task lifecycle state
- mock consumer hardware node registry
- redundant execution outputs
- malicious digest injection
- validator comparison
- challenger dispute
- slashing and weighted rewards
- simple API routes for task and node simulation
- CLI scripts for starting a swarm, spawning malicious workers, and dispatching tasks
- Docker worker simulation for local multi-node demos
- Solidity economic prototype used as an initial contract sketch

The Solidity contract is now treated as an economic logic prototype only. The intended production target is Solana programs written in Rust with Anchor.

## Live Coordination Layer

The MVP includes a lightweight Node.js websocket coordinator at `server/coordination-server.js`.

It provides:

- node registration
- heartbeat tracking
- node discovery snapshots
- task dispatch
- temporary swarm assignment
- independent simulated node responses
- malicious digest divergence
- signed receipt streaming
- local reputation persistence
- live logs and network metrics

The frontend connects to `ws://localhost:8787` when available. If the coordinator is offline, the UI falls back to the deterministic local simulation so the presentation remains stable.

## Signed Execution Receipts

Each simulated node has an ed25519 identity. Receipts include:

- task id
- node id
- role
- output digest
- issue timestamp
- public key
- signature
- verification status

This does not prove the computation itself. It proves authorship of an output commitment and creates a realistic path toward signed worker agents, challenge evidence, and Solana settlement records.

## Persistent Reputation

Reputation persists locally in `data/reputation.json`.

Tracked fields:

- reputation score
- slash count
- successful validations
- challenge wins
- malicious flags
- last seen timestamp

In the Solana version, this maps to PDA-owned node profile state or compressed reputation state.

## Runtime Flow

1. Idle hardware exists.
2. A user yeets a task into the network.
3. Nodes bid with stake, reliability, hardware score, and role preference.
4. A temporary off-chain swarm forms.
5. Executors run redundant computation.
6. One malicious node submits a divergent digest.
7. Validators compare outputs.
8. A challenger disputes the suspicious result.
9. Fraud is proven.
10. Stake is slashed, reputation updates, rewards distribute, and the verified result emerges.

## Future Solana Program Architecture

```txt
Consumer Hardware Nodes
  - signed node agent
  - hardware profile
  - role preference
  - uptime and reliability signals
        |
        v
Off-Chain Execution Swarm
  - temporary task assignment
  - redundant execution
  - validator comparison
  - challenger dispute
        |
        v
Solana Settlement Layer
  - Anchor programs
  - PDA node identity
  - task escrow accounts
  - staking vaults
  - slashing logic
  - reward distribution
  - reputation state
        |
        v
Protocol Memory
  - fraud history
  - reliability updates
  - challenger success rate
  - future swarm selection weights
```

### Candidate Accounts

- `NodeProfile` PDA: owner, hardware commitment, stake vault, role preference, reliability score, fraud history.
- `TaskEscrow` PDA: requester, reward pool, task metadata hash, redundancy, verification threshold, timeout.
- `SwarmAssignment` PDA: selected executors, validators, challengers, assignment nonce, status.
- `ResultCommitment` PDA: output digest commitments, validator attestations, challenge state.
- `SettlementRecord` PDA: verified digest, rewards paid, slash amounts, reputation deltas.

### Candidate Instructions

- `register_node`
- `add_stake`
- `yeet_task`
- `commit_result`
- `attest_result`
- `open_challenge`
- `resolve_challenge`
- `slash_node`
- `distribute_rewards`
- `update_reputation`

The MVP keeps these actions simulated to avoid overbuilding. The architecture is designed so each simulated action maps to a future Solana instruction.

## Off-Chain Execution + On-Chain Accountability

Compute workloads should not run directly on-chain. Matrix operations, image processing, inference, and rendering are too heavy for a settlement layer. Solana should not become the compute engine; it should become the accountability engine.

YEET separates concerns:

- off-chain agents perform compute
- validators and challengers inspect outputs
- Solana programs hold stake and task escrow
- settlement records distribute rewards and slash fraud
- reputation state influences future swarm formation

This keeps the system believable. The chain verifies economic consequences, not the entire workload.

## Adversarial Threat Model

The MVP models a small but important subset of attacks:

- malicious executor submits an incorrect digest
- lazy validator copies visible agreement
- challenger suppression makes fraud detection underpaid
- colluding majority tries to finalize a false output
- Sybil nodes attempt to crowd out reliable hardware
- reputation washing hides prior fraud
- stake griefing disrupts settlement at a cost

Current mitigations:

- redundant execution
- validator reward path
- challenger bonus path
- slashing for fraudulent outputs
- reliability-weighted rewards
- fraud history on node state
- minority correctness highlighted in the demo

Future mitigations can include stronger node identity, stake-weighted selection caps, compressed reputation state, cryptographic receipts, and validator subnetworks.

## Economic Model

Rewards are weighted by correctness contribution:

- executors earn for correct compute
- validators earn for independent agreement
- challengers earn larger rewards for proving fraud
- fraudulent nodes lose stake
- reliability and fraud history affect future selection

The intended equilibrium is not "everyone follows the majority." The intended equilibrium is "honest independent verification is more profitable than lazy agreement, and successful dissent is highly rewarded when the network is wrong."

## Potential Future Integrations

- Anchor migration for Solana-native programs
- Rust node agent for signed task receipts
- Solana compressed state for large reputation graphs
- zk proof adapters for specific deterministic workloads
- decentralized reputation graph across node operators
- validator subnetworks for specialized task domains
- storage integrations for task metadata and output artifacts
- stake-weighted but Sybil-aware node selection

## Realistic Limitations

The current MVP is not production infrastructure.

- execution is simulated
- consensus scoring is off-chain
- P2P networking is not implemented
- wallet integration is demo-level
- Solidity is only an economic prototype
- no Anchor program is deployed yet
- cryptographic verification is not implemented
- AI training is intentionally out of scope

These limits are strengths for a hackathon demo because the prototype focuses on the core mechanism: economically incentivized computational correctness.

## Roadmap

### Phase 1: Simulation + Economic Model Validation

Polish the current demo, tune rewards, and test adversarial scenarios such as malicious minority, malicious majority, lazy validators, and successful challengers.

### Phase 2: Rust + Anchor Migration

Implement Solana program accounts and instructions for node identity, task escrow, staking, slashing, reward distribution, and reputation updates.

### Phase 3: Real Node Networking

Build a lightweight node agent that can register hardware, accept assignments, run deterministic workloads, sign receipts, and submit commitments.

### Phase 4: Distributed AI Inference

Support practical inference-style workloads where result comparison and challenge logic are feasible without claiming full model training.

### Phase 5: Cryptographic Verification Layers

Add workload-specific verification adapters, zk proof integrations where practical, signed execution traces, and challenge evidence formats.

### Phase 6: Open Decentralized Compute Marketplace

Let requesters yeet real tasks into a broader network of specialized node operators while Solana handles settlement, accountability, and reputation.

## Judge Summary

YEET is a believable early-stage decentralized compute protocol prototype for Solana because it makes the hard part visible: not just finding compute, but economically verifying that compute was correct.
