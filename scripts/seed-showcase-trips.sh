#!/bin/bash
# seed-showcase-trips.sh
# Creates 3 real public trips with AI-generated itineraries for showcase purposes.
# These trips are owned by a dedicated "showcase" user so they appear in public feeds.

set -euo pipefail

API="http://localhost:8080"
AI_API="http://localhost:3000/api/ai"

SHOWCASE_EMAIL="showcase-trips@trippy.app"
SHOWCASE_PASSWORD="Showcase2026!"
SHOWCASE_NAME="Trippy Explorer"

echo "============================================"
echo " Trippy Showcase Trip Seeder"
echo "============================================"

# ── 1. Register showcase user (ignore if already exists) ──
echo "[1/6] Registering showcase user..."
REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SHOWCASE_EMAIL\",\"password\":\"$SHOWCASE_PASSWORD\",\"displayName\":\"$SHOWCASE_NAME\"}")
REG_CODE=$(echo "$REG_RESP" | tail -1)
REG_BODY=$(echo "$REG_RESP" | sed '$d')
echo "  Register status: $REG_CODE"

# ── 2. Login as showcase user ──
echo "[2/6] Logging in as showcase user..."
LOGIN_RESP=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SHOWCASE_EMAIL\",\"password\":\"$SHOWCASE_PASSWORD\",\"rememberMe\":true}")
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  echo "  ERROR: Failed to get access token. Response: $LOGIN_RESP"
  exit 1
fi
echo "  Got access token: ${TOKEN:0:20}..."

AUTH="Authorization: Bearer $TOKEN"

# ── 3. Create 3 trips ──
echo "[3/6] Creating showcase trips..."

# Trip 1: Santorini
T1_RESP=$(curl -s -X POST "$API/trips" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "title": "Santorini, Greece — 5-Day Trip",
    "destination": "Santorini, Greece",
    "description": "Island-hopping across the Cyclades with sunset dinners in Oia, blue-domed churches, and volcanic beaches.",
    "startDate": "2026-08-14",
    "endDate": "2026-08-18",
    "visibility": "PUBLIC",
    "coverImageUrl": "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80"
  }')
T1_ID=$(echo "$T1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
echo "  Trip 1 (Santorini): $T1_ID"

# Trip 2: Barcelona
T2_RESP=$(curl -s -X POST "$API/trips" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "title": "Barcelona, Spain — 4-Day Trip",
    "destination": "Barcelona, Spain",
    "description": "Gaudí architecture tour, tapas crawl through El Born, and sunset at Park Güell.",
    "startDate": "2026-10-03",
    "endDate": "2026-10-06",
    "visibility": "PUBLIC",
    "coverImageUrl": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80"
  }')
T2_ID=$(echo "$T2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
echo "  Trip 2 (Barcelona): $T2_ID"

# Trip 3: Swiss Alps
T3_RESP=$(curl -s -X POST "$API/trips" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "title": "Swiss Alps — 7-Day Trip",
    "destination": "Zermatt, Switzerland",
    "description": "Winter wonderland: skiing in Zermatt, fondue nights, the Glacier Express, and Matterhorn views.",
    "startDate": "2026-12-20",
    "endDate": "2026-12-26",
    "visibility": "PUBLIC",
    "coverImageUrl": "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80"
  }')
T3_ID=$(echo "$T3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
echo "  Trip 3 (Swiss Alps): $T3_ID"

if [ -z "$T1_ID" ] || [ -z "$T2_ID" ] || [ -z "$T3_ID" ]; then
  echo "ERROR: One or more trips failed to create."
  echo "T1: $T1_RESP"
  echo "T2: $T2_RESP"
  echo "T3: $T3_RESP"
  exit 1
fi

# ── 4. Generate AI itineraries via the Next.js API proxy ──
echo "[4/6] Generating AI itineraries (this may take 30-60s per trip)..."

generate_itinerary() {
  local TRIP_ID=$1
  local DEST=$2
  local START=$3
  local END=$4
  local LABEL=$5

  echo "  Generating itinerary for $LABEL ($DEST)..."
  ITIN_RESP=$(curl -s -X POST "$AI_API/itineraries" \
    -H "Content-Type: application/json" \
    -H "Cookie: trippy_access_token=$TOKEN" \
    -H "$AUTH" \
    --max-time 90 \
    -d "{
      \"constraints\": {
        \"destination\": \"$DEST\",
        \"startDate\": \"$START\",
        \"endDate\": \"$END\",
        \"budgetLevel\": \"MODERATE\",
        \"adults\": 2
      },
      \"interests\": [\"Culture\", \"Food\", \"Sightseeing\"],
      \"tone\": \"friendly\"
    }")

  # Check if response has itinerary
  HAS_ITIN=$(echo "$ITIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('itinerary') or d.get('days') else 'no')" 2>/dev/null || echo "no")

  if [ "$HAS_ITIN" = "no" ]; then
    echo "    WARNING: AI itinerary may not have generated. Response (first 200 chars): ${ITIN_RESP:0:200}"
    return 1
  fi

  # Transform AI response into itinerary update format and save
  echo "  Saving itinerary to trip $TRIP_ID..."
  
  # Use Python to transform the AI response into the update format
  ITIN_PAYLOAD=$(python3 << PYEOF
import json, sys

try:
    data = json.loads('''$ITIN_RESP''')
except:
    print("{}", file=sys.stderr)
    sys.exit(1)

days = data.get("itinerary", data.get("days", []))
day_plans = []
for day in days:
    day_num = day.get("dayNumber", day.get("day_number", 1))
    activities = []
    for act in day.get("activities", []):
        activities.append({
            "title": act.get("title", "Activity"),
            "description": act.get("description", ""),
            "location": act.get("location", ""),
            "startTime": act.get("time", "").split("-")[0].strip() if act.get("time") else None,
            "endTime": act.get("time", "").split("-")[1].strip() if act.get("time") and "-" in act.get("time","") else None,
            "category": act.get("category", "OTHER").upper() if act.get("category") else "OTHER",
            "notes": act.get("tips", "")
        })
    
    # Add metadata activity for weather and transport
    meta = {}
    if day.get("weather"):
        meta["weather"] = day["weather"]
    if day.get("transportRecommendations"):
        meta["transportRecommendations"] = day["transportRecommendations"]
    if meta:
        activities.append({
            "title": "__METADATA__",
            "description": json.dumps(meta),
            "location": "",
            "category": "OTHER",
            "notes": ""
        })
    
    from datetime import datetime, timedelta
    start = datetime.strptime("$START", "%Y-%m-%d")
    date_str = (start + timedelta(days=day_num - 1)).strftime("%Y-%m-%d")
    
    day_plans.append({
        "dayNumber": day_num,
        "date": date_str,
        "title": day.get("title", f"Day {day_num}"),
        "activities": activities
    })

print(json.dumps({"dayPlans": day_plans}))
PYEOF
  )

  if [ -z "$ITIN_PAYLOAD" ] || [ "$ITIN_PAYLOAD" = "{}" ]; then
    echo "    WARNING: Failed to transform itinerary payload."
    return 1
  fi

  # Save itinerary to trip
  SAVE_RESP=$(curl -s -X PUT "$API/trips/$TRIP_ID/itinerary" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$ITIN_PAYLOAD")
  echo "    Itinerary saved for $LABEL."
  return 0
}

generate_itinerary "$T1_ID" "Santorini, Greece" "2026-08-14" "2026-08-18" "Santorini" || true
generate_itinerary "$T2_ID" "Barcelona, Spain" "2026-10-03" "2026-10-06" "Barcelona" || true
generate_itinerary "$T3_ID" "Zermatt, Switzerland" "2026-12-20" "2026-12-26" "Swiss Alps" || true

# ── 5. Set all trips to PLANNED status ──
echo "[5/6] Setting trips to PLANNED status..."
curl -s -X PATCH "$API/trips/$T1_ID/status" -H "Content-Type: application/json" -H "$AUTH" -d '{"status":"PLANNED"}' > /dev/null
curl -s -X PATCH "$API/trips/$T2_ID/status" -H "Content-Type: application/json" -H "$AUTH" -d '{"status":"PLANNED"}' > /dev/null
curl -s -X PATCH "$API/trips/$T3_ID/status" -H "Content-Type: application/json" -H "$AUTH" -d '{"status":"PLANNED"}' > /dev/null
echo "  All trips set to PLANNED."

# ── 6. Summary ──
echo ""
echo "============================================"
echo " Showcase trips created successfully!"
echo "============================================"
echo "  Santorini:  $T1_ID"
echo "  Barcelona:  $T2_ID"
echo "  Swiss Alps: $T3_ID"
echo ""
echo "  Owner: $SHOWCASE_EMAIL ($SHOWCASE_NAME)"
echo "  These trips will appear in public feeds"
echo "  for all users on both homepage and dashboard."
echo "============================================"
