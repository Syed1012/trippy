-- =============================================================================
-- Trip Service Schema Bootstrap
-- =============================================================================
-- Creates the trip-service tables inside trip_schema for fresh PostgreSQL
-- volumes. This script is intended to be the source of truth for local
-- bootstrapping, with Hibernate configured to validate instead of mutate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS trip_schema.trips (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    destination VARCHAR(500) NOT NULL,
    description VARCHAR(2000),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    max_participants INTEGER NOT NULL DEFAULT 20,
    cover_image_url VARCHAR(2048),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_trips_max_participants CHECK (max_participants BETWEEN 1 AND 20)
);

CREATE TABLE IF NOT EXISTS trip_schema.itineraries (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_itineraries_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip_schema.trips (id)
);

CREATE TABLE IF NOT EXISTS trip_schema.participants (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID,
    email VARCHAR(254),
    role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    joined_at TIMESTAMPTZ,
    CONSTRAINT uq_participants_trip_user UNIQUE (trip_id, user_id),
    CONSTRAINT uq_participants_trip_email UNIQUE (trip_id, email),
    CONSTRAINT fk_participants_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip_schema.trips (id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user_id
    ON trip_schema.participants (user_id);

CREATE TABLE IF NOT EXISTS trip_schema.day_plans (
    id UUID PRIMARY KEY,
    itinerary_id UUID NOT NULL,
    day_number INTEGER NOT NULL,
    date DATE,
    title VARCHAR(200),
    voting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    voting_deadline TIMESTAMPTZ,
    voting_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_day_plans_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES trip_schema.itineraries (id)
);

CREATE INDEX IF NOT EXISTS idx_day_plans_itinerary_id
    ON trip_schema.day_plans (itinerary_id);

CREATE TABLE IF NOT EXISTS trip_schema.activities (
    id UUID PRIMARY KEY,
    day_plan_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(2000),
    location VARCHAR(500),
    start_time TIME,
    end_time TIME,
    category VARCHAR(20) NOT NULL DEFAULT 'OTHER',
    notes VARCHAR(1000),
    estimated_cost NUMERIC(12,2),
    currency VARCHAR(8),
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_activities_order_index CHECK (order_index >= 0),
    CONSTRAINT fk_activities_day_plan
        FOREIGN KEY (day_plan_id)
        REFERENCES trip_schema.day_plans (id)
);

CREATE INDEX IF NOT EXISTS idx_activities_day_plan_id
    ON trip_schema.activities (day_plan_id);

CREATE TABLE IF NOT EXISTS trip_schema.activity_comments (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_comments_activity
        FOREIGN KEY (activity_id)
        REFERENCES trip_schema.activities (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_comments_activity_id
    ON trip_schema.activity_comments (activity_id);

CREATE TABLE IF NOT EXISTS trip_schema.activity_votes (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    vote_type VARCHAR(10) NOT NULL,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_activity_votes_activity_user UNIQUE (activity_id, user_id),
    CONSTRAINT fk_activity_votes_activity
        FOREIGN KEY (activity_id)
        REFERENCES trip_schema.activities (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_votes_activity_id
    ON trip_schema.activity_votes (activity_id);

CREATE TABLE IF NOT EXISTS trip_schema.day_plan_votes (
    id UUID PRIMARY KEY,
    day_plan_id UUID NOT NULL,
    user_id UUID NOT NULL,
    vote_type VARCHAR(10) NOT NULL,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_day_plan_votes_dayplan_user UNIQUE (day_plan_id, user_id),
    CONSTRAINT fk_day_plan_votes_day_plan
        FOREIGN KEY (day_plan_id)
        REFERENCES trip_schema.day_plans (id)
);

CREATE INDEX IF NOT EXISTS idx_day_plan_votes_day_plan_id
    ON trip_schema.day_plan_votes (day_plan_id);