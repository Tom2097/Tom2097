-- lib/feedback/engine.ts (Module #11: Feedback Management) reads/writes
-- public.feedback, public.feedback_comments and public.feedback_votes
-- throughout (submitFeedback, listFeedback, getFeedback, updateFeedback,
-- deleteFeedback, createComment, getFeedbackStats, voteFeedback), but no
-- migration ever created them -- every call hit a genuine Postgres "relation
-- does not exist" error. Columns below are derived from the exact
-- .select()/.insert()/.update() shapes in engine.ts and the mirrored types
-- in lib/feedback/types.ts.
--
-- vote_count on feedback is read (never written) by engine.ts -- voteFeedback
-- inserts/deletes a feedback_votes row and then re-reads feedback.vote_count,
-- so it must be kept in sync automatically. A trigger on feedback_votes does
-- that here rather than trusting application code to maintain a denormalized
-- counter. A similar trigger keeps feedback.updated_at current, since
-- getFeedbackStats derives responseTime from the delta between created_at
-- and updated_at.
--
-- Defensive (IF NOT EXISTS / DROP POLICY IF EXISTS) throughout, per this
-- repo's established migration convention.

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  submitted_by UUID,
  assigned_to UUID,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('bug', 'feature', 'improvement', 'question', 'general')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'in_progress', 'resolved', 'closed', 'wont_fix')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  rating SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  vote_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_org_status ON feedback(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_org_type ON feedback(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_feedback_org_created_at ON feedback(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_org_vote_count ON feedback(organization_id, vote_count DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org feedback" ON feedback;
CREATE POLICY "Users can view their org feedback" ON feedback FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  submitted_by UUID,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_org ON feedback_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON feedback_comments(feedback_id);

ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org feedback comments" ON feedback_comments;
CREATE POLICY "Users can view their org feedback comments" ON feedback_comments FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS feedback_votes (
  organization_id UUID NOT NULL,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_org ON feedback_votes(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id ON feedback_votes(feedback_id);

ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org feedback votes" ON feedback_votes;
CREATE POLICY "Users can view their org feedback votes" ON feedback_votes FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Keep feedback.vote_count in sync with feedback_votes so voteFeedback's
-- re-read of the parent row reflects the vote it just added/removed.
CREATE OR REPLACE FUNCTION sync_feedback_vote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback SET vote_count = vote_count + 1 WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feedback_votes_sync ON feedback_votes;
CREATE TRIGGER trg_feedback_votes_sync
  AFTER INSERT OR DELETE ON feedback_votes
  FOR EACH ROW EXECUTE FUNCTION sync_feedback_vote_count();

-- Keep feedback.updated_at current on every UPDATE, since
-- getFeedbackStats() derives responseTime from (updated_at - created_at).
CREATE OR REPLACE FUNCTION touch_feedback_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feedback_touch_updated_at ON feedback;
CREATE TRIGGER trg_feedback_touch_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION touch_feedback_updated_at();

-- Separate from the "feedback" table above: app/api/feedback/route.ts backs
-- a lightweight, anonymous-friendly NPS-style widget (components/
-- feedback-widget.tsx) that only ever collects a 1-5 star rating plus an
-- optional free-text comment -- no title/type/category/status/votes, none
-- of the structured feature-request/bug-triage shape the "feedback" table
-- above models. Previously that route inserted into a table literally
-- named "feedback" with no organization_id and a completely different
-- column shape, which would have collided with (and corrupted) the
-- org-scoped feedback listing above. Giving it its own table avoids that
-- collision entirely.
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_responses_org ON nps_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_created_at ON nps_responses(created_at DESC);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org nps responses" ON nps_responses;
CREATE POLICY "Users can view their org nps responses" ON nps_responses FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
