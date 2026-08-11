-- Real visitor analytics for the public marketing site (founder ask: "see
-- who is visiting my site and from where"). Deliberately scoped to
-- anonymous/public-site traffic only, not authenticated in-app product
-- usage -- lib/analytics/site-visits.ts's recordVisit() is only ever
-- called by the client tracker when no Supabase session exists. Tracking
-- an existing paying customer's internal team's every dashboard click
-- without being asked is a different, much bigger feature than "who's
-- visiting my site."
--
-- Raw IP is never persisted -- only a one-way hash (ip_hash), kept just
-- for rough unique-visitor dedup. The IP itself is used transiently
-- in-request for the geolocation lookup (lib/analytics/site-visits.ts) and
-- discarded, never written to this table.
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  country_code TEXT,
  city TEXT,
  region_name TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'mobile' | 'desktop'
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_country_code ON site_visits(country_code);
CREATE INDEX IF NOT EXISTS idx_site_visits_session ON site_visits(session_id);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
-- Platform-wide, not tenant data -- no end-user policy at all (same
-- pattern as event_job_subscriptions/founding_slots). Writes go through
-- the service-role client from the public track/visit route; reads go
-- through the founder-gated /api/platform/visitors route, same convention
-- as /api/platform/payouts.
