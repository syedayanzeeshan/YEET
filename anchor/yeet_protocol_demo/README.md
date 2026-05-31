# yeet_protocol_demo

Permissionless correctness-market Anchor program for YEET Protocol.

## Program ID (devnet)

```
4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd
```

## Instructions

| Instruction     | Description                                              |
|-----------------|----------------------------------------------------------|
| `create_task`   | Escrow reward lamports, open task PDA `["task", task_id]` |
| `submit_claim`  | One claim per node per task PDA `["claim", task_id, node]` |
| `resolve_task`  | Permissionless settlement from stored claims               |

## Difficulty

`difficulty` = minimum number of claims required before `resolve_task` succeeds.

## Deploy

```bash
npm run anchor:deploy:demo
# or
bash scripts/deploy-yeet-protocol-demo.sh devnet
```

## Source

Implementation: [`../programs/yeet_protocol_demo/`](../programs/yeet_protocol_demo/)
