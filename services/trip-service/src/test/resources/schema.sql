-- Creates the trip_schema before Hibernate DDL runs in tests.
-- The quoted identifier preserves lowercase to match @Table(schema = "trip_schema").
CREATE SCHEMA IF NOT EXISTS "trip_schema";