-- Follow-up to 20260901000000_human_in_the_loop.sql, per the founder's
-- Tier 1 decisions:
--   1. Separation of duties stays strict whenever a second eligible person
--      exists; it relaxes only as a last resort (a single-person org, or
--      the only person left holding the assignee role) -- flagged
--      distinctly (self_approved) so it's never silently indistinguishable
--      from a real second-person approval in the audit trail.
--   2. Default timeout behavior: escalate to the owner. This needs
--      actor_id to be nullable on har_actions -- a system-triggered SLA
--      escalation isn't "a named person decided", so there is no actor to
--      attribute it to. The row is still real, append-only audit history;
--      it just has a null actor and a channel of 'system' instead of a
--      person and 'in_app'.

ALTER TABLE har_actions ADD COLUMN IF NOT EXISTS self_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE har_actions ALTER COLUMN actor_id DROP NOT NULL;
