#!/usr/bin/env bash
# Run simulated workers without Docker Compose (plain docker build/run).
# Requires: Docker engine. On Linux, host.docker.internal is added via host-gateway.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
IMAGE="${YEET_WORKER_IMAGE:-yeet-worker:local}"
COORD="${YEET_COORDINATOR_URL:-ws://host.docker.internal:8787}"

docker build -f Dockerfile.worker -t "$IMAGE" .

for name in yeet-honest-a yeet-honest-b yeet-malicious; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    echo "Removing existing container: $name"
    docker rm -f "$name" >/dev/null
  fi
done

COMMON=(--rm -d --add-host=host.docker.internal:host-gateway -e YEET_COORDINATOR_URL="$COORD")

docker run "${COMMON[@]}" --name yeet-honest-a -e NODE_ID=docker-honest-a -e LATENCY_MS=700 "$IMAGE"
docker run "${COMMON[@]}" --name yeet-honest-b -e NODE_ID=docker-honest-b -e LATENCY_MS=950 "$IMAGE"
docker run "${COMMON[@]}" --name yeet-malicious -e NODE_ID=docker-malicious -e MALICIOUS=1 -e LATENCY_MS=1200 "$IMAGE"

echo "Started yeet-honest-a, yeet-honest-b, yeet-malicious (image $IMAGE)."
echo "Ensure npm run coord:dev is listening on the host port matching $COORD"
echo "Stop workers: docker rm -f yeet-honest-a yeet-honest-b yeet-malicious"
