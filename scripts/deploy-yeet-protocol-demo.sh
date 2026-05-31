#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/anchor"

CLUSTER="${1:-devnet}"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

echo "==> Syncing program keypair"
mkdir -p programs/yeet_protocol_demo/target/deploy target/deploy
if [[ -f target/deploy/yeet_protocol_demo-keypair.json ]]; then
  cp target/deploy/yeet_protocol_demo-keypair.json programs/yeet_protocol_demo/target/deploy/
elif [[ -f programs/yeet_protocol_demo/target/deploy/yeet_protocol_demo-keypair.json ]]; then
  cp programs/yeet_protocol_demo/target/deploy/yeet_protocol_demo-keypair.json target/deploy/
fi

echo "==> Building yeet_protocol_demo"
anchor build -p yeet_protocol_demo

PROGRAM_ID="$(anchor keys list 2>/dev/null | awk '/yeet_protocol_demo/ {print $2}')"
echo "==> Program ID: ${PROGRAM_ID}"

cp target/deploy/yeet_protocol_demo-keypair.json programs/yeet_protocol_demo/target/deploy/

echo "==> Deploying to ${CLUSTER}"
anchor deploy -p yeet_protocol_demo \
  --provider.cluster "${CLUSTER}" \
  --provider.wallet "${WALLET}"

echo ""
echo "============================================"
echo " YEET Protocol Demo deployed"
echo " Program ID : ${PROGRAM_ID}"
echo " Cluster    : ${CLUSTER}"
echo " Explorer   : https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}"
echo "============================================"
echo ""
echo "Add to .env.local:"
echo "NEXT_PUBLIC_SOLANA_PROGRAM_ID=${PROGRAM_ID}"
echo "NEXT_PUBLIC_SOLANA_CLUSTER=${CLUSTER}"
