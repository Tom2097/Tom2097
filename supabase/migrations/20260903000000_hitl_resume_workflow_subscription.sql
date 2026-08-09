-- Wires human.action.completed -> hitl.resume_workflow into the event bus +
-- jobs layer, same event->job dispatch pattern as every other cross-module
-- reaction (deal.won -> crm.auto_provision, capa.created ->
-- compliance.notify_capa, etc). This is what actually resumes a real
-- business workflow after a human acts on its HAR -- lib/hitl/continuations.ts
-- is the registry each gate (capa_closure, esignature_send, ...) plugs a
-- resume handler into.

INSERT INTO event_job_subscriptions (event_type, job_type) VALUES
  ('human.action.completed', 'hitl.resume_workflow')
ON CONFLICT (event_type, job_type) DO NOTHING;
