ALTER TABLE ai_schema.generation_history
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
