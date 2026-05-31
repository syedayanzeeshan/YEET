# YEET Anchor Program

This folder contains the SOL-first Anchor program for the judge-verifiable Solana proof path.

It models:

- PDA-based node identity
- task escrow accounts
- SOL reward escrow
- slashing and reputation state
- reputation updates
- settlement records for verified digests and off-chain receipt bundle hashes

The Next.js MVP still simulates execution and consensus off-chain. The Anchor program is the accountability layer: it records node registration, task opening, SOL escrow funding, verified digest settlement, receipt bundle hashes, and reputation/slash effects.

## Devnet Commands

From the repo root:

```bash
npm run anchor:build
npm run anchor:deploy
```

Deployment is configured for:

- cluster: `devnet`
- wallet: `/home/yantharos/.config/solana/id.json`
- deployer public key: `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ`

After deployment, replace the placeholder `Yeet111...` program id in `Anchor.toml`, `src/lib.rs`, `.env.local`, and `anchor/app/src/pda.ts`.
