# YEET Anchor Scaffold

This folder is a credibility scaffold for the Solana migration path. It is not deployed production code.

It models:

- PDA-based node identity
- task escrow accounts
- staking and slashing state
- reputation updates
- settlement records for verified digests

The current Next.js MVP still simulates execution and consensus off-chain. A future Anchor program would own task escrow, node profile state, reward distribution, and slashing authority.
