-- =============================================================================
-- Itinerary recommendations (local Ollama) — isolated from generation_history.
-- Stores the 3 AI suggestion options per trip day surfaced in the AI sidebar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_schema.itinerary_recommendations (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    day_number INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    vibe VARCHAR(40),
    title VARCHAR(300) NOT NULL,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    estimated_cost NUMERIC(12, 2),
    currency VARCHAR(8),
    maps_url VARCHAR(1024),
    notes VARCHAR(2000),
    model VARCHAR(80),
    source VARCHAR(20) NOT NULL DEFAULT 'AI',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itinerary_recommendations_trip
    ON ai_schema.itinerary_recommendations (trip_id);

CREATE INDEX IF NOT EXISTS idx_itinerary_recommendations_trip_day
    ON ai_schema.itinerary_recommendations (trip_id, day_number);
