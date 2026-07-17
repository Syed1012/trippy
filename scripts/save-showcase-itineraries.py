#!/usr/bin/env python3
"""
Save AI-generated itineraries to showcase trips.
Usage: python3 scripts/save-showcase-itineraries.py
"""
import json
import subprocess
import sys
from datetime import datetime, timedelta

API = "http://localhost:8080"
AI_API = "http://localhost:3000/api/ai"

TRIPS = [
    {
        "id": "8ff742ad-591a-4d40-926f-8d1413ce3cfd",
        "dest": "Santorini, Greece",
        "start": "2026-08-14",
        "end": "2026-08-18",
        "label": "Santorini",
    },
    {
        "id": "7adb516b-9822-42b2-97f9-1a9328d410d4",
        "dest": "Barcelona, Spain",
        "start": "2026-10-03",
        "end": "2026-10-06",
        "label": "Barcelona",
    },
    {
        "id": "a17ff35b-3c8f-4534-9a41-2cf59ca96aa0",
        "dest": "Zermatt, Switzerland",
        "start": "2026-12-20",
        "end": "2026-12-26",
        "label": "Swiss Alps",
    },
]


def curl_json(method, url, headers, data=None, timeout=90):
    """Run curl and return parsed JSON."""
    cmd = ["curl", "-s", "--max-time", str(timeout), "-X", method, url]
    for h in headers:
        cmd += ["-H", h]
    if data:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        print(f"  WARN: Non-JSON response: {result.stdout[:200]}", file=sys.stderr)
        return {}


def main():
    print("=" * 50)
    print(" Showcase Itinerary Generator")
    print("=" * 50)

    # Login
    print("[1] Logging in...")
    login_resp = curl_json("POST", f"{API}/auth/login", [], {
        "email": "showcase-trips@trippy.app",
        "password": "Showcase2026!",
        "rememberMe": True,
    })
    token = login_resp.get("accessToken", "")
    if not token:
        print("ERROR: Login failed", file=sys.stderr)
        sys.exit(1)
    print(f"  Token: {token[:20]}...")
    auth = f"Authorization: Bearer {token}"

    for trip in TRIPS:
        trip_id = trip["id"]
        dest = trip["dest"]
        start = trip["start"]
        end = trip["end"]
        label = trip["label"]

        print(f"\n[AI] Generating itinerary for {label} ({dest})...")

        ai_resp = curl_json("POST", f"{AI_API}/itineraries", [auth], {
            "constraints": {
                "destination": dest,
                "startDate": start,
                "endDate": end,
                "budgetLevel": "MODERATE",
                "adults": 2,
            },
            "interests": ["Culture", "Food", "Sightseeing"],
            "tone": "friendly",
        }, timeout=120)

        # Extract daily plan
        daily_plan = ai_resp.get("dailyPlan", ai_resp.get("itinerary", ai_resp.get("days", [])))
        if not daily_plan:
            print(f"  ERROR: No itinerary generated for {label}. Keys: {list(ai_resp.keys())}")
            continue
        print(f"  Got {len(daily_plan)} days")

        # Transform into itinerary update payload
        start_date = datetime.strptime(start, "%Y-%m-%d")
        day_plans = []
        for day in daily_plan:
            day_num = day.get("dayNumber", day.get("day_number", 1))
            date_str = (start_date + timedelta(days=day_num - 1)).strftime("%Y-%m-%d")

            activities = []
            for act in day.get("activities", []):
                time_str = act.get("time", "")
                start_time = None
                end_time = None
                if time_str and "-" in time_str:
                    parts = time_str.split("-")
                    s = parts[0].strip()
                    e = parts[1].strip() if len(parts) > 1 else None
                    import re
                    if re.match(r"^\d{1,2}:\d{2}$", s):
                        start_time = s
                    if e and re.match(r"^\d{1,2}:\d{2}$", e):
                        end_time = e

                cat = (act.get("category") or "OTHER").upper()
                if cat == "CULTURE":
                    cat = "SIGHTSEEING"

                activities.append({
                    "title": act.get("title", "Activity"),
                    "description": act.get("description", ""),
                    "location": act.get("location", ""),
                    "startTime": start_time,
                    "endTime": end_time,
                    "category": cat,
                    "notes": act.get("tips", ""),
                })

            # Add metadata for weather + transport
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
                    "notes": "",
                })

            day_plans.append({
                "dayNumber": day_num,
                "date": date_str,
                "title": day.get("title", f"Day {day_num}"),
                "activities": activities,
            })

        # Save itinerary
        print(f"  Saving itinerary ({len(day_plans)} days, {sum(len(d['activities']) for d in day_plans)} activities)...")
        save_resp = curl_json("PUT", f"{API}/trips/{trip_id}/itinerary", [auth], {"dayPlans": day_plans})
        if save_resp:
            print(f"  ✓ Itinerary saved for {label}")
        else:
            print(f"  WARNING: Empty response when saving itinerary for {label}")

    print("\n" + "=" * 50)
    print(" All showcase itineraries generated!")
    print("=" * 50)


if __name__ == "__main__":
    main()
