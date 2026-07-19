DELETE FROM notification_schema.web_push_subscriptions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY endpoint
                   ORDER BY created_at DESC NULLS LAST, id DESC
               ) AS duplicate_rank
        FROM notification_schema.web_push_subscriptions
    ) duplicate_subscriptions
    WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_web_push_subscriptions_endpoint
    ON notification_schema.web_push_subscriptions (endpoint);
