CREATE TABLE web_push_subscriptions (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_push_subscriptions_user_id ON web_push_subscriptions(user_id);
