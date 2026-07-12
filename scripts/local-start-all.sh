#!/usr/bin/env bash
# Local-only launcher for Trippy:
# - starts Docker infra (Postgres, Redis, RabbitMQ)
# - starts all backend services
# - starts frontend (Next.js)
# This script is intended for local development usage, not CI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/infra/docker/.env"
DOCKER_DIR="$PROJECT_DIR/infra/docker"
FRONTEND_DIR="$PROJECT_DIR/frontend"
STATE_DIR="$PROJECT_DIR/.local/runtime"
LOG_DIR="$STATE_DIR/logs"
PID_DIR="$STATE_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
}

port_listening() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

wait_for_port() {
  local name="$1"
  local port="$2"
  local timeout_secs="${3:-90}"
  local start
  start=$(date +%s)

  while true; do
    if port_listening "$port"; then
      echo "[ok] $name is listening on :$port"
      return 0
    fi

    if [ $(( $(date +%s) - start )) -ge "$timeout_secs" ]; then
      echo "[warn] Timed out waiting for $name on :$port"
      return 1
    fi
    sleep 2
  done
}

write_or_update_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

write_or_update_frontend_env() {
  local key="$1"
  local value="$2"
  local file="$FRONTEND_DIR/.env.local"

  touch "$file"
  if grep -q "^${key}=" "$file"; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    echo "${key}=${value}" >> "$file"
  fi
}

load_env_file() {
  local env_file="$1"
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blanks and comments.
    [ -z "$line" ] && continue
    case "$line" in
      \#*)
        continue
        ;;
    esac

    # Only parse KEY=VALUE lines.
    case "$line" in
      *=*)
        ;;
      *)
        continue
        ;;
    esac

    local key="${line%%=*}"
    local value="${line#*=}"
    export "$key=$value"
  done < "$env_file"
}

start_service() {
  local name="$1"
  local relative_dir="$2"
  local port="$3"
  local pid_file="$PID_DIR/${name}.pid"
  local log_file="$LOG_DIR/${name}.log"

  if port_listening "$port"; then
    echo "[skip] $name already running on :$port"
    return 0
  fi

  echo "[start] $name (:${port})"
  (
    cd "$PROJECT_DIR/$relative_dir"
    nohup "$PROJECT_DIR/mvnw" spring-boot:run \
      -Dspring-boot.run.jvmArguments='-Dspring.devtools.restart.enabled=false' \
      > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )
}

start_frontend() {
  local port="3000"
  local pid_file="$PID_DIR/frontend.pid"
  local log_file="$LOG_DIR/frontend.log"

  if port_listening "$port"; then
    echo "[skip] frontend already running on :$port"
    return 0
  fi

  echo "[start] frontend (:${port})"
  (
    cd "$FRONTEND_DIR"
    nohup npm run dev -- --port "$port" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )
}

main() {
  require_cmd docker
  require_cmd lsof
  require_cmd npm

  if [ ! -f "$PROJECT_DIR/mvnw" ]; then
    echo "Cannot find mvnw at $PROJECT_DIR/mvnw"
    exit 1
  fi

  if [ ! -f "$ENV_FILE" ]; then
    echo "Cannot find env file: $ENV_FILE"
    exit 1
  fi

  # Export vars for spring-boot:run processes without shell-sourcing .env.
  load_env_file "$ENV_FILE"

  # Keep app URL aligned with local IP so links in emails are usable.
  local ip
  ip="$(sh "$SCRIPT_DIR/detect-ip.sh")"
  local app_base_url="http://${ip}:3000"
  write_or_update_env "APP_BASE_URL" "$app_base_url"
  export APP_BASE_URL="$app_base_url"

  # Write the dynamic API URL for the frontend Next.js dev server
  local api_url="http://${ip}:8080"
  write_or_update_frontend_env "NEXT_PUBLIC_API_URL" "$api_url"

  echo "============================================"
  echo " Trippy local launcher"
  echo " APP_BASE_URL: $APP_BASE_URL"
  echo " Logs dir:     $LOG_DIR"
  echo "============================================"

  if port_listening 5432 && port_listening 6379 && port_listening 5672; then
    echo "[skip] infra ports already available (:5432, :6379, :5672)"
  else
    echo "[start] docker infra"
    (
      cd "$DOCKER_DIR"
      if ! docker compose --env-file "$ENV_FILE" up -d; then
        echo "[warn] docker compose failed (likely local port/container conflict). Continuing with existing local services."
      fi
    )
  fi

  echo "[wait] infra ports"
  wait_for_port "Postgres" 5432 90 || true
  wait_for_port "Redis" 6379 90 || true
  wait_for_port "RabbitMQ" 5672 90 || true

  # Start core services first.
  start_service "user-service" "services/user-service" 8081
  start_service "trip-service" "services/trip-service" 8082
  start_service "chat-service" "services/chat-service" 8083
  start_service "ai-service" "services/ai-service" 8084
  start_service "notification-service" "services/notification-service" 8085
  start_service "payment-service" "services/payment-service" 8086

  # Wait before starting gateway so downstream targets have time to bind.
  wait_for_port "user-service" 8081 120 || true
  wait_for_port "trip-service" 8082 120 || true

  start_service "api-gateway" "services/api-gateway" 8080
  start_frontend

  echo ""
  echo "[wait] app ports"
  wait_for_port "api-gateway" 8080 120 || true
  wait_for_port "frontend" 3000 120 || true

  echo ""
  echo "Ready (or still warming if warnings were shown)."
  echo "Gateway:  http://localhost:8080"
  echo "Frontend: http://localhost:3000"
  echo ""
  echo "Logs examples:"
  echo "  tail -f $LOG_DIR/api-gateway.log"
  echo "  tail -f $LOG_DIR/frontend.log"
}

main "$@"
