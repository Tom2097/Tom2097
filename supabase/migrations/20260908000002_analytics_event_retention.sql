-- lib/analytics/dashboard.ts's getDashboardMetrics() has always called
-- analytics_event_retention, but 20260716000000_performance_resources.sql
-- only ever created analytics_event_timeseries/_breakdown/_summary --
-- retention was missed. Every call to GET /api/v1/analytics/overview
-- (unused by any frontend today, but needed for the mobile AI Analytics
-- module) 500'd with "function analytics_event_retention does not exist".
--
-- Simplified N-day retention: of the users active on the first day of the
-- window, what fraction were active again on any later day in the window.
-- Matches the "simplified - 7-day retention" comment already in
-- getDashboardMetrics rather than inventing a different definition.
CREATE OR REPLACE FUNCTION analytics_event_retention(
  p_org UUID, p_event TEXT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ
) RETURNS TABLE(retention NUMERIC) AS $$
  WITH cohort AS (
    SELECT DISTINCT user_id
    FROM analytics_events
    WHERE organization_id = p_org
      AND (p_event = '' OR event_name = p_event)
      AND user_id IS NOT NULL
      AND occurred_at >= p_start
      AND occurred_at < p_start + INTERVAL '1 day'
  ),
  retained AS (
    SELECT DISTINCT ae.user_id
    FROM analytics_events ae
    JOIN cohort c ON c.user_id = ae.user_id
    WHERE ae.organization_id = p_org
      AND (p_event = '' OR ae.event_name = p_event)
      AND ae.occurred_at >= p_start + INTERVAL '1 day'
      AND ae.occurred_at < p_end
  )
  SELECT CASE WHEN (SELECT COUNT(*) FROM cohort) = 0 THEN 0
    ELSE ROUND((SELECT COUNT(*) FROM retained)::NUMERIC / (SELECT COUNT(*) FROM cohort) * 100, 2)
  END AS retention;
$$ LANGUAGE sql STABLE;
