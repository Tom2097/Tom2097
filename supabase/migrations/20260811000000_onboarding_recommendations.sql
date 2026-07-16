-- app/onboarding/recommendations/page.tsx's module-recommendation feedback
-- (thumbs up/down) and final module selection/completion only ever touched
-- localStorage -- no server-side record was ever created, despite a code
-- comment noting "In production, this would send feedback to the AI
-- learning system."

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_modules JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS module_id TEXT;
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS helpful BOOLEAN;
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_module ON recommendation_feedback(module_id);

ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own feedback" ON recommendation_feedback;
CREATE POLICY "Users can view their own feedback" ON recommendation_feedback FOR SELECT
  USING (user_id = auth.uid());
