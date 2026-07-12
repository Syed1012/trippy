#!/bin/sh
# Starts all backend services and the frontend dev server.
# Detects the local IP so email invite links work on the local network.
# Press Ctrl+C to stop everything.
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
ENV_FILE="$PROJECT_DIR/infra/docker/.env"
SERVICES_DIR="$PROJECT_DIR/services"
FRONTEND_DIR="$PROJECT_DIR/frontend"

IP=$(sh "$SCRIPT_DIR/detect-ip.sh")
PORT=3000
APP_BASE_URL="http://$IP:$PORT"

echo "============================================"
echo "  Trippy - Starting all services"
echo "============================================"
echo "  Local IP:     $IP"
echo "  App Base URL: $APP_BASE_URL"
echo "============================================"
echo ""

# Update backend docker .env
if [ -f "$ENV_FILE" ]; then
  if grep -q "^APP_BASE_URL=" "$ENV_FILE"; then
    sed -i '' "s|^APP_BASE_URL=.*|APP_BASE_URL=$APP_BASE_URL|" "$ENV_FILE"
  else
    echo "APP_BASE_URL=$APP_BASE_URL" >> "$ENV_FILE"
  fi
else
  echo "APP_BASE_URL=$APP_BASE_URL" > "$ENV_FILE"
fi
echo "==> APP_BASE_URL written to $ENV_FILE"
export APP_BASE_URL

# Build trip-service jar if missing
if [ ! -f "$SERVICES_DIR/trip-service/target/trip-service-0.0.1-SNAPSHOT.jar" ]; then
  echo "==> Building trip-service..."
  cd "$PROJECT_DIR" && ./mvnw package -pl services/trip-service -DskipTests -q
  echo ""
fi

# Cleanup handler: kill background Java processes on exit
cleanup() {
  echo ""
  echo "==> Stopping all services..."
  # Kill java processes started from this script (the backend services)
  pkill -f "trippy" 2>/dev/null || true
  # Give them a moment to shut down
  sleep 2
  echo "==> All services stopped."
  exit 0
}
trap cleanup INT TERM

# Start backend services
echo "==> Starting backend services..."

start_service() {
  local name=$1
  local jar=$2
  if [ -f "$jar" ]; then
    echo "  Starting $name ..."
    java -jar "$jar" > "/tmp/trippy-$name.log" 2>&1 &
    echo "    PID $! | logs: tail -f /tmp/trippy-$name.log"
  else
    echo "  WARNING: $name jar not found at $jar"
  fi
}

start_service "user-service"        "$SERVICES_DIR/user-service/target/user-service-0.0.1-SNAPSHOT.jar"
start_service "trip-service"        "$SERVICES_DIR/trip-service/target/trip-service-0.0.1-SNAPSHOT.jar"
start_service "chat-service"        "$SERVICES_DIR/chat-service/target/chat-service-0.0.1-SNAPSHOT.jar"
start_service "ai-service"          "$SERVICES_DIR/ai-service/target/ai-service-0.0.1-SNAPSHOT.jar"
start_service "notification-service" "$SERVICES_DIR/notification-service/target/notification-service-0.0.1-SNAPSHOT.jar"
start_service "payment-service"     "$SERVICES_DIR/payment-service/target/payment-service-0.0.1-SNAPSHOT.jar"

echo "  Waiting for backend services to initialize..."
sleep 15

# Start API gateway last
echo "  Starting api-gateway ..."
java -jar "$SERVICES_DIR/api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar" > "/tmp/trippy-api-gateway.log" 2>&1 &
echo "    PID $! | logs: tail -f /tmp/trippy-api-gateway.log"

sleep 4

# Start frontend
echo ""
echo "==> Starting frontend on $APP_BASE_URL ..."
echo ""

cd "$FRONTEND_DIR"
npx next dev --port "$PORT" &
FRONTEND_PID=$!

echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "============================================"
echo "  All services starting."
echo "  Frontend: $APP_BASE_URL"
echo "  Press Ctrl+C to stop everything."
echo "============================================"
echo ""

# Wait for any background process to exit
wait
