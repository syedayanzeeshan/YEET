# YEET Contract Upgrade Plan

This is the upgrade path from the current demo contracts to judge-verifiable Solana proof.

## Current Proof Decision

- Settlement asset: devnet SOL.
- Token-2022: deferred until after the base proof is live.
- Pyth oracle: deferred unless reward sizing needs USD conversion.
- Deployer wallet public key: `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ`.
- Deployer local keypair path: `/home/yantharos/.config/solana/id.json`.
- Recommended hackathon shortcut: reuse the deployer as upgrade authority and demo fee payer unless the team wants stricter key separation.

## Current Contract State

- `contracts/YeetSwarm.sol` is a useful economic prototype, but it is EVM-only and still trusts one orchestrator for settlement.
- `anchor/programs/yeet_coordination/src/lib.rs` has the right account direction: node profile PDAs, task escrow PDAs, and settlement mutation.
- The Anchor program is not deploy-ready proof yet because it uses a placeholder program id, no real escrow transfer, no authority model for the coordinator, and no event surface a judge can inspect.

## Upgrade Sequence

1. Make the Anchor program the canonical contract.
   Replace the placeholder program id after deployment, set the provider to devnet, and keep the Solidity contract only as a design archive.

2. Add real SOL task escrow.
   `open_task` should transfer lamports into a PDA-owned vault instead of just storing a number. Token-2022 reward mint support can be added later.

3. Add node stake vaults.
   `register_node` should initialize a profile, then `add_stake` should lock funds in a stake PDA that can be partially slashed.

4. Split settlement into inspectable instructions.
   Keep `commit_result`, `open_challenge`, `resolve_challenge`, and `settle_task` separate so every step creates an Explorer-visible transaction.

5. Emit proof events.
   Add Anchor events for node registration, task opened, result committed, challenge opened, node slashed, and rewards paid.

6. Connect the app to devnet.
   The website should show the deployed program id, latest task PDA, latest node PDA, and transaction signatures with Solana Explorer links.

7. Move demo receipts into settlement metadata.
   The ed25519 receipts already exist off-chain. Hash the receipt bundle and write that hash into the task settlement record.

## Product Proof Targets

- Deployed devnet program id.
- At least one node registration transaction.
- At least one task-open transaction.
- At least one settlement transaction with a verified digest.
- Explorer links visible in the website during the live demo.

## Current Implementation Direction

- `open_task` is SOL-first: it transfers lamports from the requester into the task escrow account.
- Task PDAs are unique by requester and `task_nonce`.
- Settlement records `verified_digest` and `receipt_bundle_hash`, which lets the off-chain receipt stream become an on-chain-verifiable commitment.
- Anchor events are emitted for node registration, task opening, and task settlement.
- The website proof panel reads public environment variables and turns them into Solana Explorer links.

## Addresses Needed Now

- Solana devnet deployer wallet public key: `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ`.
- Matching deployer keypair file or wallet signer for deployment: `/home/yantharos/.config/solana/id.json`.
- Upgrade authority public key. Can be `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ` for the hackathon version.
- Fee payer public key for demo transactions. Can be `BgN52Bk5DMdjSzufSFGyFdkarb7XeRESxB1sGmyZDWFJ` if funded on devnet.
- Optional team treasury address for future protocol fees.

## Addresses Deferred

- Reward mint address. Not needed while rewards use SOL.
- Token-2022 mint authority. Not needed while rewards use SOL.
- Treasury token account. Not needed while rewards use SOL.
- Pyth price feed address. Not needed while reward and stake amounts are fixed in SOL.

## How To Obtain Each Address

For the fastest judge-verifiable demo, use devnet SOL first. Token-2022, Pyth, and treasury routing can be added after the base Anchor proof is live.

### Solana devnet deployer wallet public key

This is the wallet that signs the program deployment transaction.

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/yeet-devnet-deployer.json
solana config set --keypair ~/.config/solana/yeet-devnet-deployer.json
solana address
solana airdrop 2
```

Use the output of `solana address` as the deployer public key.

### Upgrade authority public key

This is the wallet allowed to upgrade the deployed Anchor program. For a hackathon demo, it can be the same keypair as the deployer. For stronger hygiene, generate a separate keypair.

```bash
solana-keygen new --outfile ~/.config/solana/yeet-upgrade-authority.json
solana-keygen pubkey ~/.config/solana/yeet-upgrade-authority.json
```

Use the output of `solana-keygen pubkey` as the upgrade authority public key. When deploying, pass this keypair or configure Anchor/Solana deploy settings so it becomes the upgrade authority.

### Fee payer public key

This is the wallet that pays transaction fees for demo transactions. It can be the deployer wallet, but separating it makes demos easier to fund without touching the upgrade key.

```bash
solana-keygen new --outfile ~/.config/solana/yeet-demo-fee-payer.json
solana-keygen pubkey ~/.config/solana/yeet-demo-fee-payer.json
solana airdrop 2 $(solana-keygen pubkey ~/.config/solana/yeet-demo-fee-payer.json)
```

Use the fee payer pubkey in app/server config when sending demo transactions.

### Reward mint address, only if using Token-2022

Skip this if rewards are paid in devnet SOL. If we want a custom YEET reward token, create a Token-2022 mint and use the mint address returned by the creation command.

```bash
spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFjTLWv4FjvKJzHaL2Y1 create-token
```

The command prints a mint address. That is the reward mint address.

### Token-2022 mint authority

This is the wallet allowed to mint the custom reward token. By default, it is usually the keypair that created the mint. For cleaner control, create a dedicated authority keypair.

```bash
solana-keygen new --outfile ~/.config/solana/yeet-mint-authority.json
solana-keygen pubkey ~/.config/solana/yeet-mint-authority.json
```

If the mint already exists, set or transfer authority with `spl-token authorize`.

### Treasury token account

This is the token account that holds YEET reward tokens for payouts or protocol-owned reserves. Create it for the reward mint.

```bash
spl-token create-account <REWARD_MINT_ADDRESS>
```

The command prints the token account address. That is the treasury token account.

### Pyth price feed address

Only use this if the program needs oracle-based stake sizing, reward conversion, or USD-denominated thresholds. Pick the relevant devnet feed from Pyth's official price feed list and copy its Solana address.

For a first demo, we can avoid Pyth entirely and use fixed devnet SOL or fixed Token-2022 amounts.

### Optional team treasury address

This is just a wallet controlled by the team for protocol fees. On devnet, generate one dedicated keypair.

```bash
solana-keygen new --outfile ~/.config/solana/yeet-team-treasury.json
solana-keygen pubkey ~/.config/solana/yeet-team-treasury.json
```

Use the printed public key as the treasury address.
