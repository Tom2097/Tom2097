-- lib/analytics/materialized-views.ts was 100% fabricated: view "definitions"
-- were hardcoded objects and refreshView() just did
-- `Math.floor(Math.random() * 500) + view.rowCount` -- refreshing never ran
-- any query. This creates two REAL Postgres materialized views backed by
-- the real digit_scores table (the other two fake views, "driver_impact"
-- and "cohort_percentiles", referenced tables/columns -- driver_events,
-- a cohort column -- that don't exist anywhere in this codebase, so they
-- are dropped rather than given invented schema to pretend they're real).

CREATE MATERIALIZED VIEW IF NOT EXISTS digit_scores_summary AS
SELECT organization_id, metric, AVG(score) AS avg_score, COUNT(*) AS row_count, MAX(created_at) AS last_data_at
FROM digit_scores
GROUP BY organization_id, metric;

CREATE UNIQUE INDEX IF NOT EXISTS idx_digit_scores_summary_pk ON digit_scores_summary(organization_id, metric);

CREATE MATERIALIZED VIEW IF NOT EXISTS organization_score_benchmarks AS
SELECT
  organization_id,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_score) AS median_overall_score,
  AVG(overall_score) AS avg_overall_score,
  AVG(compliance_score) AS avg_compliance_score,
  AVG(resources_score) AS avg_resources_score,
  AVG(performance_score) AS avg_performance_score,
  COUNT(*) AS row_count
FROM digit_scores
GROUP BY organization_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_score_benchmarks_pk ON organization_score_benchmarks(organization_id);

CREATE OR REPLACE FUNCTION refresh_known_materialized_view(view_name text)
RETURNS void AS $$
BEGIN
  IF view_name NOT IN ('digit_scores_summary', 'organization_score_benchmarks') THEN
    RAISE EXCEPTION 'Unknown materialized view: %', view_name;
  END IF;
  EXECUTE format('REFRESH MATERIALIZED VIEW %I', view_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION count_materialized_view_rows(view_name text)
RETURNS bigint AS $$
DECLARE
  result bigint;
BEGIN
  IF view_name NOT IN ('digit_scores_summary', 'organization_score_benchmarks') THEN
    RAISE EXCEPTION 'Unknown materialized view: %', view_name;
  END IF;
  EXECUTE format('SELECT COUNT(*) FROM %I', view_name) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- App-level bookkeeping materialized views themselves don't carry: refresh
-- cadence + last-refreshed timestamp per view. Platform-level, not tenant
-- data, so service-role only.
CREATE TABLE IF NOT EXISTS materialized_view_registry (
  name TEXT PRIMARY KEY,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_refreshed_at TIMESTAMPTZ
);
ALTER TABLE materialized_view_registry ADD COLUMN IF NOT EXISTS refresh_interval_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE materialized_view_registry ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;

INSERT INTO materialized_view_registry (name, refresh_interval_minutes)
VALUES ('digit_scores_summary', 60), ('organization_score_benchmarks', 240)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE materialized_view_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access" ON materialized_view_registry;
CREATE POLICY "No direct client access" ON materialized_view_registry FOR ALL USING (false) WITH CHECK (false);
