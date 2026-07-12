#!/usr/bin/env bash
# Local-only stop script for Trippy:
# - stops frontend (Next.js)
# - stops all backend services (Spring Boot)
# - stops Docker infra (Postgres, RabbitMQ)
# - cleans up PID files

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/infra/docker/.env"
DOCKER_DIR="$PROJECT_DIR/infra/docker"
STATE_DIR="$PROJECT_DIR/.local/runtime"
PID_DIR="$STATE_DIR/pids"

echo "============================================"
# Stop backend and frontend processes by PID files
echo "Stopping backend services and frontend via PIDs..."
if [ -d "$PID_DIR" ]; then
  for pid_file in "$PID_DIR"/*.pid; do
    if [ -f "$pid_file" ]; then
      pid=$(cat "$pid_file")
      name=$(basename "$pid_file" .pid)
      if kill -0 "$pid" 2>/dev/null; then
        echo "Killing parent process $name (PID $pid)..."
        kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
    fi
  done
fi

# Stop any remaining processes listening on the service ports
PORTS=(3000 8080 8081 8082 8083 8084 8085 8086)
echo "Ensuring no processes are left listening on ports: ${PORTS[*]}..."
for port in "${PORTS[@]}"; do
  # Find PIDs listening on the port
  pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true
  if [ -n "$pids" ]; then
    for pid in $pids; do
      echo "Force killing process PID $pid listening on port $port..."
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
done

# Stop Docker infrastructure
echo "Stopping Docker infrastructure..."
if [ -f "$ENV_FILE" ]; then
  (
    cd "$DOCKER_DIR"
    docker compose --env-file "$ENV_FILE" down || true
  )
else
  echo "No ENV file found, skipping docker compose down."
fi

echo "============================================"
echo "All services stopped."
echo "============================================"
