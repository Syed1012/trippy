-- V4__notification_preferences.sql
-- Add notification_preferences table under notification_schema

CREATE TABLE IF NOT EXISTS notification_schema.notification_preferences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(30) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_notification_preferences_user_type UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_schema.notification_preferences (user_id);
