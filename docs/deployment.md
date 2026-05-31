# YEET Deployment Notes

## Recommended Free Setup

Use two deployments:

1. Vercel for the Next.js website.
2. Render Free Web Service, or Railway Free/Trial, for the websocket coordinator.

This split matters because the frontend is a normal Next.js app, but `server/coordination-server.js` is a persistent websocket process. Vercel is good for the website, but the coordinator should run on a host that supports a long-running Node process.

## Devnet Proof Configuration

- Cluster: `devnet`
- Settlement asset: SOL
- Deployer / upgrade authority / fee payer public key: `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ`
- Local deploy keypair path: `/home/yantharos/.config/solana/id.json`

Never commit the keypair file. The path is safe to document; the file contents are not.

## Local Tooling Prerequisites

The devnet deploy machine needs:

- Solana CLI
- Rust + Cargo
- Anchor CLI, preferably via AVM
- Devnet SOL in the deployer wallet

Current known local state:

- Solana CLI is installed and points to devnet.
- The configured keypair matches `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ`.
- Anchor CLI is not installed yet.
- Rust/Cargo is not installed yet.
- The deployer wallet needs devnet SOL before deployment.

Funding command:

```bash
solana airdrop 2 BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ
```

If the public faucet is rate-limited, use another devnet faucet or wait and retry.

## Vercel Website

Set this environment variable in Vercel after the coordinator is deployed:

```txt
NEXT_PUBLIC_YEET_COORDINATOR_WS=wss://<coordinator-host>
```

Use the default Vercel build command:

```bash
npm run build
```

The Vercel deployment should not need the Solana private key. For the demo, deploy the Anchor program locally, then show program IDs and Explorer links in the website.

## Coordinator Host

The coordinator start command is:

```bash
npm run coord:dev
```

Set the coordinator service port with:

```txt
YEET_COORDINATOR_PORT=<platform-port>
```

Some hosts inject the port as `PORT`. If needed, update `server/coordination-server.js` to read `process.env.PORT` before deployment.

## Free Host Options

- Best simple split: Vercel Hobby for frontend + Render Free Web Service for coordinator.
- Also workable: Vercel Hobby for frontend + Railway Free/Trial for coordinator.
- Less ideal for "free": Fly.io is strong for long-running services, but current docs describe pay-as-you-go pricing and no general free account tier for new users.

## Demo Deployment Order

1. Deploy or run the coordinator on a websocket-capable host.
2. Copy its `wss://` URL.
3. Add `NEXT_PUBLIC_YEET_COORDINATOR_WS` to Vercel.
4. Deploy the Next.js app to Vercel.
5. Deploy the Anchor program to Solana devnet from the local machine using `/home/yantharos/.config/solana/id.json`.
6. Add the real program ID and Explorer links to the website proof panel.

## First On-chain Proof Run

Build and deploy locally:

```bash
npm run anchor:build
npm run anchor:deploy
```

After deployment:

1. Copy the deployed program id.
2. Replace `Yeet111111111111111111111111111111111111111` in the Anchor program config and `.env.local`.
3. Run one node registration transaction.
4. Run one SOL-funded `open_task` transaction.
5. Run one `settle_task` transaction with the verified digest and receipt bundle hash.
6. Put the resulting program id, node PDA, task PDA, open-task transaction, and settlement transaction into Vercel environment variables:

```txt
NEXT_PUBLIC_YEET_PROGRAM_ID=<DEPLOYED_PROGRAM_ID>
NEXT_PUBLIC_YEET_NODE_PROFILE=<NODE_PROFILE_PDA>
NEXT_PUBLIC_YEET_TASK_ESCROW=<TASK_ESCROW_PDA>
NEXT_PUBLIC_YEET_OPEN_TASK_TX=<OPEN_TASK_SIGNATURE>
NEXT_PUBLIC_YEET_SETTLE_TASK_TX=<SETTLE_TASK_SIGNATURE>
```
