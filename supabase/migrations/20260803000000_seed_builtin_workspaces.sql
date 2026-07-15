-- The Configure > Workspaces tab has always displayed 4 hardcoded "built-in"
-- workspace cards (Operations/Performance/Resources/Compliance) as pure UI
-- decoration -- they were never real rows in the workspaces table. That made
-- them silently non-functional as auto-routing targets (classifyAndRoute
-- checks real workspace rows by vertical/id) and meant the org's Auto-Routing
-- dropdown only listed the one workspace it had explicitly created via the
-- setup wizard.
--
-- Backfill real workspace rows for these 4 built-in verticals for the
-- reporting organization only, so they become genuine, routable workspaces.
-- Scoped to a single org (not all orgs) per explicit request. Uses an
-- existence check rather than a unique constraint so the org remains free
-- to create additional workspaces of the same vertical later via the wizard.

INSERT INTO workspaces (organization_id, name, description, vertical, auto_classify, auto_route, hitl_enabled)
SELECT '5dc89703-1b07-4051-8a32-393488d868ef'::uuid, d.name, d.description, d.vertical, true, true, true
FROM (
  VALUES
    ('Operations Workspace', 'Operational workflows and process automation', 'operational'),
    ('Performance Workspace', 'Performance monitoring and analytics', 'performance'),
    ('Resource Workspace', 'Resource and knowledge management', 'resources'),
    ('Compliance Workspace', 'Compliance frameworks and audits', 'compliance')
) AS d(name, description, vertical)
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.organization_id = '5dc89703-1b07-4051-8a32-393488d868ef'::uuid AND w.vertical = d.vertical
);
