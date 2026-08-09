-- Wires two more cross-module event->job flows into the event bus + jobs
-- layer (pattern established by 20260828000000_capa_inventory_event_subscriptions.sql):
--
--   deal.stalled       -> crm.notify_stalled          (lib/crm/jobs.ts)
--   objective.at_risk  -> performance.notify_at_risk   (lib/analytics/jobs.ts)
--
-- deal.stalled is published by lib/crm/stalled.ts's runStalledDealCheck,
-- run by the Coolify-scheduled poller at app/api/v1/crm/deals/run-due (a
-- time-since-last-activity detection, not a single write, so it needs its
-- own scheduled scan rather than a trigger on one API route -- see that
-- file's header comment). crm_deals.stalled_notified_at (added below)
-- records when a deal was last flagged, so the scan only re-publishes a
-- deal once it has picked up new activity and gone stalled again -- not on
-- every single poll for a deal that simply remains stalled.
--
-- objective.at_risk is published by lib/analytics/okr.ts's
-- updateKeyResultValue -- the sole write path that recomputes an
-- objective's persisted status from its key results -- only on a genuine
-- transition INTO "at_risk", not on every update that leaves an
-- already-at_risk objective at_risk.

ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS stalled_notified_at TIMESTAMPTZ;

INSERT INTO event_job_subscriptions (event_type, job_type) VALUES
  ('deal.stalled', 'crm.notify_stalled'),
  ('objective.at_risk', 'performance.notify_at_risk')
ON CONFLICT (event_type, job_type) DO NOTHING;
