-- Placeholder: Schema for user service
-- To be populated in Phase 2-4

CREATE TABLE IF NOT EXISTS placeholder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);
