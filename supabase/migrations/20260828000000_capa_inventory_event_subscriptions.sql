-- Wires two new cross-module event->job flows into the event bus + jobs
-- layer added by 20260809000000_event_bus_and_jobs.sql:
--
--   capa.created    -> compliance.notify_capa   (lib/compliance/jobs.ts)
--   inventory.low   -> resources.notify_reorder (lib/resources/jobs.ts)
--
-- Publishing capa.created (lib/compliance/capa.ts's createCapa -- the sole
-- insert path for capa_records, used both by the manual "log a CAPA" UI and
-- the automatic legal/complaint-classified-document path in
-- lib/operational/auto-create.ts) or inventory.low (lib/resources/inventory.ts's
-- updateStock, the sole choke point for inventory quantity changes) now
-- enqueues a background_jobs row that the run-due poller picks up and runs
-- through the handler registered for that job_type.

INSERT INTO event_job_subscriptions (event_type, job_type) VALUES
  ('capa.created', 'compliance.notify_capa'),
  ('inventory.low', 'resources.notify_reorder')
ON CONFLICT (event_type, job_type) DO NOTHING;
