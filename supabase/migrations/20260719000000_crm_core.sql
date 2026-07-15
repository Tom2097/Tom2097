-- Backs the CRM rebuild (lib/crm/engine.ts, lib/crm/extensions.ts, and the
-- app/api/v1/crm/* routes wired to them): every crm_* table except
-- crm_companies was queried by real app code but never migrated -- the same
-- recurring pattern as every other module fixed this session. Defensive
-- (IF NOT EXISTS) throughout, per this repo's established convention.

-- crm_companies already exists (20260716000000_performance_resources.sql)
-- with only id/organization_id/name/industry/created_at. engine.ts's real
-- CRUD needs the rest of the Company shape, plus parent_id for the Accounts
-- Hierarchy tab.
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_crm_companies_parent ON crm_companies(parent_id);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'inactive', 'archived')),
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  lead_score NUMERIC,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(organization_id, status);

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  probability NUMERIC NOT NULL DEFAULT 10,
  expected_close_date TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  lost_reason TEXT,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_deals_org ON crm_deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_company ON crm_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'call', 'email', 'meeting', 'task')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact', 'deal')),
  entity_id UUID NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_org ON crm_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_entity ON crm_activities(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS crm_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  line_items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  valid_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_org ON crm_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_deal ON crm_quotes(deal_id);

CREATE TABLE IF NOT EXISTS crm_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact', 'deal')),
  entity_id UUID NOT NULL,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_org ON crm_timeline(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_entity ON crm_timeline(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('company', 'contact', 'deal')),
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_org ON crm_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(organization_id, status);

CREATE TABLE IF NOT EXISTS crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  template_id UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_crm_communications_org ON crm_communications(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_communications_contact ON crm_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_communications_deal ON crm_communications(deal_id);

CREATE TABLE IF NOT EXISTS crm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_templates_org ON crm_templates(organization_id);

CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'at_risk', 'churned')),
  health_score NUMERIC NOT NULL DEFAULT 100,
  health_score_breakdown JSONB,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step TEXT,
  renewal_date TIMESTAMPTZ,
  upsell_potential TEXT CHECK (upsell_potential IN ('low', 'medium', 'high')),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_org ON customer_accounts(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_company ON customer_accounts(company_id);

-- support_tickets: columns match the live component's contract exactly
-- (components/digit/crm-support-tickets.tsx sends `category` and
-- `assigned_to`, not the `assigneeId` the pre-existing route handler used --
-- the route is being corrected to match this table, not the other way
-- around).
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(organization_id, status);

-- Persists lib/crm/extensions.ts's computeLeadScore output instead of
-- recomputing it in memory on every request (backs the Lead Inbox's
-- sort-by-priority and Next-Best-Action).
CREATE TABLE IF NOT EXISTS crm_lead_scores (
  contact_id UUID PRIMARY KEY REFERENCES crm_contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_lead_scores_org ON crm_lead_scores(organization_id);

-- Backs the Event Instrumentation tab -- same shape as analytics_events
-- (20260716000000_performance_resources.sql) rather than a new convention.
CREATE TABLE IF NOT EXISTS crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_events_org_name_time ON crm_events(organization_id, event_name, occurred_at);

-- Replaces lib/crm/whatsapp.ts's logWhatsAppToDeal() console.log with a real
-- write.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org ON whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_deal ON whatsapp_messages(deal_id);

-- Minimal tables queried by engine.ts's getPipelineSummaryRealtime (already
-- live on the CRM page header) -- whatsapp connection status and pending AI
-- recommendation count.
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_org_type ON integrations(organization_id, type);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_org_status ON ai_recommendations(organization_id, status);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Org-scoped RLS, defense-in-depth only (all app access uses the
-- service-role client, which bypasses RLS), mirroring every prior migration
-- this session.
DROP POLICY IF EXISTS "Users can view their org contacts" ON crm_contacts;
CREATE POLICY "Users can view their org contacts" ON crm_contacts FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org deals" ON crm_deals;
CREATE POLICY "Users can view their org deals" ON crm_deals FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org activities" ON crm_activities;
CREATE POLICY "Users can view their org activities" ON crm_activities FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org quotes" ON crm_quotes;
CREATE POLICY "Users can view their org quotes" ON crm_quotes FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org timeline" ON crm_timeline;
CREATE POLICY "Users can view their org timeline" ON crm_timeline FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org tasks" ON crm_tasks;
CREATE POLICY "Users can view their org tasks" ON crm_tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org communications" ON crm_communications;
CREATE POLICY "Users can view their org communications" ON crm_communications FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org templates" ON crm_templates;
CREATE POLICY "Users can view their org templates" ON crm_templates FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org customer accounts" ON customer_accounts;
CREATE POLICY "Users can view their org customer accounts" ON customer_accounts FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org support tickets" ON support_tickets;
CREATE POLICY "Users can view their org support tickets" ON support_tickets FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org lead scores" ON crm_lead_scores;
CREATE POLICY "Users can view their org lead scores" ON crm_lead_scores FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org crm events" ON crm_events;
CREATE POLICY "Users can view their org crm events" ON crm_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Users can view their org whatsapp messages" ON whatsapp_messages FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org integrations" ON integrations;
CREATE POLICY "Users can view their org integrations" ON integrations FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org ai recommendations" ON ai_recommendations;
CREATE POLICY "Users can view their org ai recommendations" ON ai_recommendations FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
