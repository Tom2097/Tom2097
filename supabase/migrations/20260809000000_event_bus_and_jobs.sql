-- Real event bus + background jobs layer.
--
-- lib/events/bus.ts's publish()/subscribe() already had a well-designed,
-- fully-typed DomainEvent union and correct insert/select shapes -- but the
-- tables it targeted (domain_events, event_subscriptions) never existed in
-- any migration, so every call silently no-op'd (Supabase-js doesn't throw
-- on a failed query by default). Same for lib/documents/events.ts's
-- document_events. This migration makes all three real, and adds the piece
-- that never existed at all: a background_jobs queue + an internal
-- event->job dispatch table, so publishing an event can cause a DIFFERENT
-- module's logic to run asynchronously, outside the publishing request --
-- the actual architectural gap identified in the wiring-brief audit.

CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_domain_events_org_type ON domain_events(organization_id, event_type, created_at DESC);

-- External webhook subscriptions (per-org, matches lib/events/bus.ts's
-- existing subscribe()/publish() shape: an org registers an endpoint to be
-- POSTed to when a given event type fires).
CREATE TABLE IF NOT EXISTS event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_org_type ON event_subscriptions(organization_id, event_type) WHERE enabled;

-- Internal job dispatch: platform-wide (not per-org), code/migration-defined
-- mapping of event_type -> job_type. This is what actually lets "deal.won"
-- in CRM cause "run the auto-provision chain" to happen automatically,
-- asynchronously, in a different module -- the missing piece.
CREATE TABLE IF NOT EXISTS event_job_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  job_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_job_subscriptions_unique ON event_job_subscriptions(event_type, job_type);

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_due ON background_jobs(status, run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_org ON background_jobs(organization_id, created_at DESC);

-- Atomically claims due jobs: UPDATE ... WHERE id IN (SELECT ... FOR UPDATE
-- SKIP LOCKED) RETURNING *, so two overlapping poller invocations (the
-- Coolify scheduled task fires every minute; a slow run could still be in
-- flight when the next one starts) can never claim the same row twice.
CREATE OR REPLACE FUNCTION claim_due_jobs(p_limit INT DEFAULT 20)
RETURNS SETOF background_jobs
LANGUAGE sql
AS $$
  UPDATE background_jobs
  SET status = 'running', locked_at = now(), attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM background_jobs
    WHERE status = 'pending' AND run_at <= now()
    ORDER BY run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

CREATE TABLE IF NOT EXISTS document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_events_org_doc ON document_events(organization_id, document_id, created_at DESC);

ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_events ENABLE ROW LEVEL SECURITY;
-- event_job_subscriptions is a platform-wide handler registry, not tenant
-- data -- service-role only, same pattern as the `permissions` catalog.

DROP POLICY IF EXISTS "Users can view their org domain events" ON domain_events;
CREATE POLICY "Users can view their org domain events" ON domain_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their org event subscriptions" ON event_subscriptions;
CREATE POLICY "Users can manage their org event subscriptions" ON event_subscriptions FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org background jobs" ON background_jobs;
CREATE POLICY "Users can view their org background jobs" ON background_jobs FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org document events" ON document_events;
CREATE POLICY "Users can view their org document events" ON document_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

INSERT INTO event_job_subscriptions (event_type, job_type) VALUES
  ('deal.won', 'crm.auto_provision')
ON CONFLICT (event_type, job_type) DO NOTHING;
