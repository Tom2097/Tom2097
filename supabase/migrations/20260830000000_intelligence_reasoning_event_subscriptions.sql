-- Wires the AI Intelligence workspace's generic cross-workspace reasoning
-- job (lib/intelligence/reasoning.ts, job_type
-- "intelligence.reason_about_event") into the event bus + jobs layer added
-- by 20260809000000_event_bus_and_jobs.sql.
--
-- Unlike capa.created -> compliance.notify_capa (a FIXED severity rule --
-- see 20260828000000_capa_inventory_event_subscriptions.sql), this handler
-- calls a real model to judge, per event and grounded in a short real
-- recent event history for the org, whether it's actually worth surfacing
-- as an insight.generated/risk.flagged event. The common, honest outcome
-- for a routine event is that the model judges it NOT worth flagging and
-- nothing further happens.
--
-- This list is a deliberate, curated allowlist, not "every event type in
-- the union" -- it doubles as this feature's rate-limit/cost control at
-- this app's real scale (a small self-hosted deployment; see
-- lib/intelligence/reasoning.ts's header comment for the full reasoning).
-- Included: event types that represent a genuine business-relevant
-- occurrence with plausible cross-workspace signal.
-- Deliberately excluded:
--   * capa.created -- already has its own dedicated fixed-rule handler
--     (compliance.notify_capa, event_job_subscriptions row added in
--     20260828000000_capa_inventory_event_subscriptions.sql); mapping it
--     here too would double-react to the same event with no concrete
--     reason to.
--   * insight.generated / risk.flagged themselves -- mapping either back to
--     intelligence.reason_about_event would make the brain reason about
--     its own output forever.
--   * high-volume/routine event types with little cross-workspace signal
--     on their own: compliance.audit_appended, compliance.signature_*,
--     resources.asset_created / asset_tagged / asset_scanned,
--     performance.report_generated, workflow.started,
--     document.version_created, compliance.capa_closed.
--   * check.expiring -- added to the DomainEvent union concurrently with
--     this migration and shaped identically to the existing
--     compliance.cert_expiring; left out here rather than guessed at to
--     avoid double-mapping the same real-world occurrence under two event
--     names. Revisit once its relationship to compliance.cert_expiring is
--     clear.

INSERT INTO event_job_subscriptions (event_type, job_type) VALUES
  ('compliance.gap_detected', 'intelligence.reason_about_event'),
  ('compliance.cert_expiring', 'intelligence.reason_about_event'),
  ('resources.low_stock', 'intelligence.reason_about_event'),
  ('resources.maintenance_due', 'intelligence.reason_about_event'),
  ('performance.anomaly_detected', 'intelligence.reason_about_event'),
  ('performance.threshold_breached', 'intelligence.reason_about_event'),
  ('objective.at_risk', 'intelligence.reason_about_event'),
  ('operational.document_ingested', 'intelligence.reason_about_event'),
  ('operational.record_populated', 'intelligence.reason_about_event'),
  ('workflow.completed', 'intelligence.reason_about_event'),
  ('deal.won', 'intelligence.reason_about_event'),
  ('deal.stalled', 'intelligence.reason_about_event'),
  ('inventory.low', 'intelligence.reason_about_event')
ON CONFLICT (event_type, job_type) DO NOTHING;
