# DIGIT MASTER SPECIFICATION v1.0
## Operationally Intelligent AI-Integrated Enterprise Platform

**Date:** June 10, 2026  
**Status:** ARCHITECTURAL DESIGN (PRE-IMPLEMENTATION)  
**Scope:** Complete system design for 21 integrated modules

---

## EXECUTIVE SUMMARY

DIGIT is an enterprise-grade, operationally intelligent platform that combines multi-tenant SaaS architecture with adaptive AI systems, workflow automation, and comprehensive business intelligence. The system is designed to evolve continuously through feedback loops, learning mechanisms, and autonomous optimization while maintaining strict security, compliance, and data governance.

**Core Value Proposition:**
- Self-evolving AI that improves decision-making over time
- Unified platform for CRM, analytics, automation, and compliance
- Enterprise-grade security with role-based access control
- Real-time insights across business operations
- Seamless third-party integrations

---

## PART 1: MODULE DEPENDENCY MAP & RELATIONSHIPS

### Tier 1: Foundation (Required First)
```
Multi-Tenant Architecture
    ├── Supports all other modules
    ├── Tenant isolation at DB, API, cache layers
    └── Tenant context propagated through request pipeline
    
Authentication
    ├── Prerequisite for RBAC, Audit Logging, Notification System
    ├── Provides session/token management
    ├── Integrates with Subscription Billing (license limits)
    └── Required for Data Retention policies
    
Encryption & Data Security
    ├── Underlying layer for all data-at-rest
    ├── SSL/TLS for all data-in-transit
    └── Key management service for tenant secrets
```

### Tier 2: Access Control & Core Infrastructure
```
RBAC Permissions
    ├── Built on: Authentication
    ├── Protects: All business modules
    ├── Used by: API Gateway, Document Management, CRM modules
    └── Feeds into: Audit Logging
    
Audit Logging
    ├── Built on: Authentication, RBAC
    ├── Captures: All user actions, API calls, data changes
    ├── Used by: Compliance, Legal & Compliance, Monitoring
    └── Required for: Data Retention, Reporting
    
Monitoring & Reliability
    ├── Built on: Audit Logging
    ├── Tracks: System health, performance, errors
    ├── Feeds into: Notification System (alerts)
    └── Input for: AI Assistant optimization
```

### Tier 3: Data & Intelligence Foundation
```
Analytics Engine
    ├── Built on: Audit Logging, all business data
    ├── Provides: Event stream processing, metrics aggregation
    ├── Feeds into: AI Assistant, Reporting Engine, Dashboard
    └── Powers: Investor CRM intelligence, Decision support

Knowledge Base
    ├── Built on: Document Management
    ├── Powers: AI Assistant (training data)
    ├── Used by: Universal Search
    └── Evolves from: Feedback Management, User interactions

Universal Search
    ├── Built on: All business modules (data sources)
    ├── Indexes: Documents, CRM records, transactions, tickets
    ├── Used by: AI Assistant, Navigation, Reporting
    └── Updated by: Analytics Engine (real-time indexing)
```

### Tier 4: AI & Automation Core
```
AI Assistant Infrastructure
    ├── Built on: Knowledge Base, Analytics Engine, Universal Search
    ├── Learns from: Audit Logging, Feedback Management
    ├── Powers: Workflow suggestions, decision support, document generation
    ├── Evolves: Through feedback loops and analytics
    └── Integrates: CRM data, company context, historical patterns

Workflow Automation
    ├── Built on: AI Assistant (suggestions), RBAC (permissions)
    ├── Depends on: Notification System (triggers)
    ├── Manages: Business processes, escalations, routing
    ├── Logs: All actions to Audit Logging
    └── Creates: Tasks in CRM systems
```

### Tier 5: Business Operations
```
Customer CRM & Investor CRM (Dual CRM Strategy)
    ├── Built on: RBAC, Authentication
    ├── Feeds into: Analytics Engine, AI Assistant, Reporting
    ├── Uses: Workflow Automation (process enforcement)
    ├── Generates: Audit logs for compliance
    └── Integrates with: Notification System (alerts/reminders)

Document Management
    ├── Built on: Multi-Tenant Architecture, RBAC
    ├── Provides: Knowledge Base content
    ├── Versioning: Integrated audit trail
    ├── Security: Encryption, access control per document
    └── Powers: Universal Search, Reporting
```

### Tier 6: Business Intelligence & Monetization
```
Reporting Engine
    ├── Built on: Analytics Engine, Audit Logging
    ├── Consumes: Data from all business modules
    ├── Generates: Custom reports, dashboards, exports
    ├── Security: Row-level security based on RBAC
    └── Powers: Executive dashboards, compliance reports

Subscription Billing
    ├── Built on: Authentication, Multi-Tenant Architecture
    ├── Manages: Licenses, feature gates, usage limits
    ├── Feeds into: Notification System (payment reminders)
    ├── Powers: Investor CRM financial tracking
    └── Integrates: Legal & Compliance (contracts, SLAs)
```

### Tier 7: Governance & Compliance
```
Legal & Compliance
    ├── Built on: Audit Logging, Subscription Billing
    ├── Manages: Contracts, agreements, compliance policies
    ├── Uses: Data Retention policies
    ├── Feeds into: Reporting Engine (compliance reports)
    └── Powers: Document Management (template library)

Data Retention
    ├── Built on: Audit Logging, Multi-Tenant Architecture
    ├── Manages: Data lifecycle, deletion schedules
    ├── Works with: Legal & Compliance (retention policies)
    ├── Executes: Background jobs for purging
    └── Logs: All deletions for audit trail

Feedback Management
    ├── Built on: Authentication, Analytics Engine
    ├── Sources: User feedback, system errors, AI recommendations
    ├── Feeds into: Knowledge Base, AI Assistant (learning)
    ├── Powers: Continuous improvement
    └── Triggers: Workflow improvements
```

### Tier 8: Integration & Extensibility
```
Integration Hub
    ├── Built on: API Gateway, RBAC
    ├── Manages: Third-party connectors (Slack, Zapier, etc.)
    ├── Feeds into: Notification System (events from external sources)
    ├── Powers: Workflow Automation (external actions)
    ├── Logs: All integrations to Audit Logging
    └── Security: OAuth 2.0, API keys per tenant

Localization System
    ├── Built on: Multi-Tenant Architecture
    ├── Provides: Language, timezone, currency formatting
    ├── Applied at: UI layer, Reports, Communications
    ├── Data-agnostic: Works across all modules
    └── Enhances: Customer CRM, Investor CRM (global operations)

Notification System
    ├── Built on: Authentication, RBAC
    ├── Triggered by: Workflow Automation, Monitoring, Billing, CRM
    ├── Channels: Email, in-app, SMS, Slack, webhooks
    ├── Managed by: User preferences and audit trails
    └── Powers: Engagement, alerts, compliance notifications
```

---

## PART 2: COMPLETE BACKEND ARCHITECTURE

### Microservice Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│    (Authentication, Rate Limiting, Request Logging, Routing)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼──────────┐         ┌───────▼─────────┐
   │ PUBLIC APIs   │         │ INTERNAL APIs   │
   │ (SaaS, SDK)   │         │ (Service-to-    │
   └───────────────┘         │  Service)       │
                             └─────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────────────────────────────┐
        │                                                      │
   ┌────▼──────────────┐  ┌──────────────────┐  ┌───────────▼────┐
   │  Auth Service     │  │  Tenant Service  │  │ RBAC Service   │
   │  - Sign up/in     │  │  - Isolation     │  │ - Permissions  │
   │  - Sessions       │  │  - Context mgmt  │  │ - Roles/groups │
   │  - Passkeys       │  │  - Rate limits   │  │ - Policy eval  │
   └───────────────────┘  └──────────────────┘  └────────────────┘
        │                             │                    │
        └─────────────────────────────┴────────────────────┘
                       │
    ┌──────────────────┴──────────────────────┐
    │                                          │
┌───▼─────────────────┐        ┌──────────────▼──────┐
│ Business Services   │        │ Data Services       │
│ - CRM Service       │        │ - Analytics Engine  │
│ - Document Service  │        │ - Search Service    │
│ - Billing Service   │        │ - Reporting Service │
│ - Workflow Service  │        │ - Data Lake Service │
│ - Integration Svc   │        │                     │
└─────────────────────┘        └─────────────────────┘
    │                                    │
    └──────────────────┬─────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    ┌───▼──────────────┐    ┌───────▼─────────┐
    │  AI Services     │    │ Notification    │
    │ - LLM Interface  │    │  Service        │
    │ - Learning Loop  │    │ - Queue mgmt    │
    │ - Reasoning      │    │ - Multi-channel │
    │ - Feedback Loop  │    │                 │
    └──────────────────┘    └─────────────────┘
         │                           │
         └─────────┬─────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Background Workers  │
        │ - Data Retention    │
        │ - Batch Jobs        │
        │ - Scheduled Tasks   │
        │ - ML Training       │
        └─────────────────────┘
```

### Service Responsibilities

**Auth Service**
- Supabase Auth + custom auth layer
- JWT token management
- Passkey/WebAuthn registration & verification
- Session lifecycle
- MFA/2FA enforcement
- Password policies & recovery

**Tenant Service**
- Tenant registration & onboarding
- Tenant isolation enforcement
- Tenant context injection into requests
- Rate limiting per tenant
- Feature flag evaluation
- Metadata management

**RBAC Service**
- Role definitions (Owner, Admin, Manager, User, Viewer)
- Permission hierarchy
- Policy engine (evaluates access decisions)
- Dynamic role assignment
- Team/group management
- Delegation chains

**CRM Services (Dual CRM)**
- **Customer CRM:** Accounts, contacts, opportunities, pipelines, deals
- **Investor CRM:** Cap table, investor profiles, funding rounds, valuations
- Both use same underlying schema with different role models
- Both feed Analytics Engine
- Both integrate with Workflow Automation

**Document Service**
- File upload/storage (Vercel Blob)
- Versioning & audit trail
- Access control per document
- Encryption at rest
- Full-text indexing for search
- Template library for compliance

**Analytics Engine**
- Real-time event streaming (Apache Kafka or Pulsar)
- Metrics aggregation (time-series DB)
- Event processing pipelines
- Business intelligence metrics
- Feeds into AI Assistant for pattern recognition
- Powers dashboards & reporting

**Search Service**
- Elasticsearch/OpenSearch for full-text + semantic search
- Indexing pipeline from all modules
- Real-time index updates
- Faceted search for filtering
- Autocomplete suggestions
- AI-powered query understanding

**AI Services (Operationally Intelligent Core)**
- LLM Integration (Claude, GPT-4, fine-tuned models)
- Prompt engineering & RAG (Retrieval Augmented Generation)
- Learning loop: User feedback → Model improvement
- Decision support: Recommendations from business context
- Workflow suggestions
- Anomaly detection
- Predictive analytics
- Document generation

**Workflow Service**
- Process definition engine (BPMN 2.0 support)
- State machine execution
- Task assignment & escalation
- Webhook triggers & callbacks
- Integration with Notification Service
- Integration with AI suggestions
- Audit trail of all workflow executions

**Integration Hub**
- OAuth 2.0 provider & connector management
- Webhook receiver (GitHub, Stripe, Zapier, etc.)
- Data sync orchestration
- API client library management
- Rate limiting per integration
- Encryption of API keys & secrets

**Notification Service**
- Multi-channel dispatch (Email, SMS, Slack, Webhooks, In-App)
- Queue-based delivery (RabbitMQ/Redis)
- Template management
- Retry logic & dead-letter queues
- User preference management
- Do-not-disturb scheduling
- Localization of messages

**Data Retention Service**
- Scheduled deletion jobs
- GDPR right-to-be-forgotten
- Data anonymization pipelines
- Backup retention policies
- Compliance with SOC 2 / ISO 27001
- Audit trail of all deletions

**Reporting Engine**
- Report builder (drag-and-drop)
- Scheduled report generation
- Multiple export formats (PDF, Excel, CSV)
- Embedded dashboards
- Row-level security applied to all reports
- Performance optimization (caching, pagination)

---

## PART 3: DATABASE ARCHITECTURE

### Database Technology Stack
- **Primary:** PostgreSQL (Supabase)
- **Analytics/OLAP:** ClickHouse (time-series, analytical queries)
- **Cache:** Redis (session store, query cache, rate limiting)
- **Search:** Elasticsearch (full-text search, indexing)
- **Blob Storage:** Vercel Blob (documents, files, media)
- **Time-Series:** InfluxDB (metrics, monitoring data)
- **Message Queue:** PostgreSQL (built-in) or RabbitMQ (scale)

### Core Schema Design (PostgreSQL)

#### Multi-Tenancy Foundation
```sql
tenants (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  created_at TIMESTAMPTZ,
  -- Metadata
  logo_url TEXT,
  website VARCHAR,
  industry VARCHAR,
  company_size VARCHAR,
  -- Settings
  timezone VARCHAR DEFAULT 'UTC',
  currency VARCHAR DEFAULT 'USD',
  language VARCHAR DEFAULT 'en',
  -- Limits & Quotas
  user_limit INT,
  storage_limit_gb INT,
  api_calls_per_month INT,
  -- Status
  status ENUM ('active', 'paused', 'suspended'),
  deleted_at TIMESTAMPTZ
)

tenant_features (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  feature_key VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, feature_key)
)
```

#### Authentication & RBAC
```sql
users (
  id UUID PRIMARY KEY (from Supabase Auth),
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR,
  avatar_url TEXT,
  -- Multi-tenant
  created_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  status ENUM ('active', 'invited', 'deactivated')
)

tenant_members (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR NOT NULL, -- 'owner', 'admin', 'manager', 'user', 'viewer'
  status ENUM ('active', 'invited', 'inactive'),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, user_id)
)

roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT TRUE,
  UNIQUE(tenant_id, name)
)

permissions (
  id UUID PRIMARY KEY,
  resource VARCHAR NOT NULL, -- 'crm', 'documents', 'analytics', etc.
  action VARCHAR NOT NULL, -- 'read', 'write', 'delete', 'manage'
  description TEXT,
  UNIQUE(resource, action)
)

role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  UNIQUE(role_id, permission_id)
)

passkeys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  credential_id VARCHAR UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_name VARCHAR,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
)

audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR NOT NULL, -- 'create', 'update', 'delete', 'export', etc.
  resource_type VARCHAR NOT NULL, -- 'contact', 'deal', 'document', etc.
  resource_id VARCHAR,
  changes JSONB, -- Before/after values
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ,
  INDEX ON (tenant_id, created_at),
  INDEX ON (user_id, created_at)
)
```

#### CRM - Customer Side
```sql
accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR NOT NULL,
  website VARCHAR,
  industry VARCHAR,
  company_size VARCHAR,
  annual_revenue DECIMAL,
  status ENUM ('prospect', 'customer', 'churned', 'lost'),
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, status)
)

contacts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID REFERENCES accounts(id),
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  title VARCHAR,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, account_id)
)

opportunities (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  name VARCHAR NOT NULL,
  amount DECIMAL,
  currency VARCHAR DEFAULT 'USD',
  stage VARCHAR NOT NULL, -- 'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  probability INT DEFAULT 0, -- 0-100
  close_date DATE,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, account_id, stage),
  INDEX ON (owner_id, close_date)
)

activities (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  related_to_type VARCHAR NOT NULL, -- 'account', 'contact', 'opportunity'
  related_to_id UUID NOT NULL,
  activity_type VARCHAR NOT NULL, -- 'call', 'email', 'meeting', 'task', 'note'
  subject VARCHAR,
  description TEXT,
  duration_minutes INT,
  completed BOOLEAN DEFAULT FALSE,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  INDEX ON (tenant_id, related_to_type, related_to_id)
)

tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title VARCHAR NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  priority ENUM ('low', 'medium', 'high', 'urgent'),
  status ENUM ('open', 'in_progress', 'completed', 'cancelled'),
  due_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, assigned_to, status)
)
```

#### CRM - Investor Side
```sql
companies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR NOT NULL,
  industry VARCHAR,
  founded_date DATE,
  website VARCHAR,
  traction_mrr DECIMAL, -- Monthly Recurring Revenue
  burn_rate DECIMAL,
  runway_months INT,
  status ENUM ('target', 'invested', 'exited', 'failed'),
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

investors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  firm VARCHAR,
  investment_stage VARCHAR, -- 'seed', 'series_a', 'series_b', etc.
  aum_range VARCHAR, -- Assets Under Management
  focus_areas TEXT[], -- Industries/sectors they invest in
  created_at TIMESTAMPTZ
)

funding_rounds (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  round_name VARCHAR NOT NULL, -- 'Seed', 'Series A', etc.
  target_amount DECIMAL,
  raised_amount DECIMAL,
  status ENUM ('planning', 'fundraising', 'closed', 'failed'),
  started_at DATE,
  closed_at DATE,
  created_at TIMESTAMPTZ
)

cap_table (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  shareholder_type VARCHAR, -- 'founder', 'employee', 'investor'
  shareholder_name VARCHAR,
  shares INT,
  share_class VARCHAR, -- 'common', 'preferred_a', 'preferred_b', etc.
  percentage DECIMAL,
  strike_price DECIMAL,
  created_at TIMESTAMPTZ
)
```

#### Documents & Knowledge Base
```sql
documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title VARCHAR NOT NULL,
  content TEXT,
  content_type VARCHAR, -- 'text', 'html', 'markdown', 'pdf'
  blob_url TEXT, -- Vercel Blob reference
  file_size_bytes INT,
  tags TEXT[],
  category VARCHAR, -- 'template', 'policy', 'guide', 'contract'
  access_level ENUM ('private', 'team', 'public'),
  owner_id UUID REFERENCES users(id),
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, category, tags)
)

document_versions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id),
  version INT NOT NULL,
  content TEXT,
  changed_by UUID REFERENCES users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ
)

knowledge_articles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title VARCHAR NOT NULL,
  content TEXT,
  slug VARCHAR UNIQUE,
  tags TEXT[],
  category VARCHAR,
  ai_generated BOOLEAN DEFAULT FALSE,
  source_document_id UUID REFERENCES documents(id),
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  INDEX ON (tenant_id, category, tags)
)
```

#### Analytics & Metrics
```sql
events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR NOT NULL, -- 'contact_created', 'deal_won', 'email_sent'
  resource_type VARCHAR,
  resource_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  INDEX ON (tenant_id, event_type, created_at)
)

metrics (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric_name VARCHAR NOT NULL, -- 'total_revenue', 'conversion_rate', 'user_count'
  metric_value DECIMAL,
  period VARCHAR NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  dimensions JSONB, -- e.g., {owner_id, opportunity_stage}
  created_at TIMESTAMPTZ,
  INDEX ON (tenant_id, metric_name, period_start)
)

dashboards (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR NOT NULL,
  description TEXT,
  layout JSONB, -- Position, size of widgets
  created_by UUID REFERENCES users(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

dashboard_widgets (
  id UUID PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES dashboards(id),
  widget_type VARCHAR, -- 'metric', 'chart', 'table', 'forecast'
  title VARCHAR,
  metric_id UUID REFERENCES metrics(id),
  config JSONB, -- Chart type, filters, etc.
  position INT, -- Order on dashboard
  created_at TIMESTAMPTZ
)
```

#### Workflow & Automation
```sql
workflows (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR NOT NULL,
  description TEXT,
  trigger_type VARCHAR, -- 'webhook', 'schedule', 'manual', 'event'
  trigger_config JSONB,
  steps JSONB, -- Array of workflow steps
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

workflow_executions (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status ENUM ('pending', 'running', 'success', 'failed'),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  INDEX ON (workflow_id, status, started_at)
)

tasks_workflow (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  title VARCHAR NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  status ENUM ('pending', 'completed', 'failed'),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

#### Notifications & Subscriptions
```sql
notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  notification_type VARCHAR NOT NULL, -- 'deal_created', 'email_received'
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  slack_enabled BOOLEAN DEFAULT FALSE,
  do_not_disturb_start TIME,
  do_not_disturb_end TIME,
  UNIQUE(user_id, notification_type)
)

notification_queue (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  recipient_user_id UUID REFERENCES users(id),
  recipient_email VARCHAR,
  notification_type VARCHAR,
  subject VARCHAR,
  body TEXT,
  template_id VARCHAR,
  template_vars JSONB,
  channels TEXT[] DEFAULT '{email}',
  status ENUM ('queued', 'sent', 'failed', 'bounced'),
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  INDEX ON (tenant_id, status, created_at)
)

subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plan_id VARCHAR NOT NULL, -- 'starter', 'professional', 'enterprise'
  status ENUM ('active', 'paused', 'cancelled', 'expired'),
  stripe_subscription_id VARCHAR,
  current_period_start DATE,
  current_period_end DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  billing_email VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
)

invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_id UUID REFERENCES subscriptions(id),
  invoice_number VARCHAR UNIQUE,
  amount DECIMAL,
  currency VARCHAR DEFAULT 'USD',
  status ENUM ('draft', 'sent', 'paid', 'failed'),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

#### Feedback & AI Learning
```sql
feedback (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  feedback_type VARCHAR, -- 'suggestion', 'bug', 'issue', 'ai_feedback'
  title VARCHAR,
  description TEXT,
  context JSONB, -- Page, feature, data context
  rating INT, -- 1-5 stars
  status ENUM ('open', 'in_review', 'implemented', 'declined'),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

ai_interactions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  prompt VARCHAR,
  response TEXT,
  model_used VARCHAR, -- 'gpt-4', 'claude', 'custom'
  tokens_used INT,
  confidence_score DECIMAL, -- 0-1
  user_rated BOOLEAN DEFAULT FALSE,
  user_rating INT, -- 1-5, if rated
  generated_action VARCHAR, -- What was recommended/executed
  created_at TIMESTAMPTZ
)

data_retention_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  resource_type VARCHAR,
  resource_id VARCHAR,
  reason VARCHAR, -- 'retention_policy', 'user_request', 'legal'
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id),
  restored_at TIMESTAMPTZ
)
```

### Indexing Strategy
- All tenant_id columns indexed (tenant isolation)
- created_at/updated_at on all transactional tables
- Foreign keys indexed for JOIN performance
- Composite indexes for common query patterns
- Partial indexes for status columns (e.g., WHERE status = 'active')
- Partition large tables by tenant_id or date range

### Row-Level Security (RLS) Policies
- Users see only data from their tenant
- Users see only records they own or are assigned to (except managers/admins)
- Admins see all tenant data
- Audit logs visible only to admins & compliance team

---

## PART 4: API ARCHITECTURE

### API Gateway Design
- **Framework:** Node.js + Express.js / Fastify
- **Authentication:** JWT token verification
- **Rate Limiting:** Token bucket per tenant/user
- **Logging:** All requests logged to audit_log
- **Request Signing:** HMAC-SHA256 for webhook verification
- **CORS:** Tenant-specific allowed origins
- **Versioning:** /v1/, /v2/ (backward compatibility)

### API Endpoints Structure

```
/api/v1/

# Multi-Tenant Context
  /tenants
    GET    - List all (admin only)
    POST   - Create tenant
    GET    /{id} - Get tenant
    PUT    /{id} - Update settings
    DELETE /{id} - Soft delete

# Authentication
  /auth
    /register - POST email/password/company
    /login - POST email/password (with MFA)
    /logout - POST (clear session)
    /refresh - POST (refresh JWT)
    /passkey
      /register/options - GET (initiate registration)
      /register/verify - POST (complete registration)
      /authenticate/options - GET (start login)
      /authenticate/verify - POST (complete login)
    /forgot-password - POST email
    /reset-password - POST token + new_password
    /verify-email - POST token
    /mfa
      /enable - POST (setup 2FA)
      /verify - POST (MFA code)

# Users & RBAC
  /users
    GET - List users in tenant
    POST - Invite user
    GET    /{id} - Get user
    PUT    /{id} - Update profile
    DELETE /{id} - Remove user
    /me - GET current user
    /me/settings - PUT notification/localization prefs
  
  /roles
    GET - List roles
    POST - Create custom role
    GET    /{id} - Get role details
    PUT    /{id} - Update role
    DELETE /{id} - Delete custom role
    /{id}/permissions - GET/PUT role permissions

# Customer CRM
  /accounts
    GET - List with filters/pagination
    POST - Create
    GET    /{id} - Get
    PUT    /{id} - Update
    DELETE /{id} - Delete (soft)
    /{id}/contacts - GET related contacts
    /{id}/opportunities - GET related opportunities
    /{id}/activities - GET activity history

  /contacts
    GET - List with filters
    POST - Create
    GET    /{id}
    PUT    /{id}
    DELETE /{id}
    /{id}/activities - POST activity
    /{id}/email-history - GET emails sent

  /opportunities
    GET - List (with pipeline view)
    POST - Create
    GET    /{id}
    PUT    /{id} - Update stage/amount
    DELETE /{id}
    /{id}/timeline - GET activity history
    /forecast - GET (AI predicted revenue)

  /activities
    GET - List
    POST - Create
    GET    /{id}
    PUT    /{id}
    DELETE /{id}

# Investor CRM
  /companies
    GET - List portfolio
    POST - Add company
    GET    /{id}
    PUT    /{id}
    /traction - PUT update metrics
    /cap-table - GET cap table
    /funding-rounds - GET rounds

  /investors
    GET - List investors
    POST - Create investor record
    GET    /{id}
    /{id}/interactions - GET interaction history

  /funding-rounds
    GET - List
    POST - Create
    GET    /{id}
    PUT    /{id} - Update status/raised amount

# Documents & Knowledge Base
  /documents
    GET - List documents
    POST - Upload document
    GET    /{id} - Get document
    PUT    /{id} - Update metadata
    DELETE /{id} - Delete
    /{id}/versions - GET all versions
    /{id}/share - POST generate share link
    /{id}/permissions - GET/PUT access rules

  /knowledge-base
    GET - List articles
    POST - Create article
    GET    /{id}
    PUT    /{id}
    /search - GET full-text search

# Analytics & Reporting
  /analytics
    /metrics - GET metrics data
    /events - GET event stream
    /dashboards
      GET - List
      POST - Create
      GET    /{id}
      PUT    /{id}
      DELETE /{id}
      /{id}/export - GET (PDF/Excel export)

  /reports
    GET - List saved reports
    POST - Create report
    GET    /{id}
    PUT    /{id}
    DELETE /{id}
    /{id}/export - GET (PDF/Excel)
    /forecast - GET AI-generated forecasts

# Workflow Automation
  /workflows
    GET - List
    POST - Create
    GET    /{id}
    PUT    /{id}
    DELETE /{id}
    /{id}/enable - POST
    /{id}/disable - POST
    /{id}/test - POST test execution

  /workflow-executions
    GET - List executions with filters
    GET    /{id} - Get execution details
    /{id}/retry - POST retry failed execution

# Notifications
  /notifications
    GET - List user notifications
    POST/{id}/read - Mark as read
    DELETE/{id} - Delete notification
    /preferences
      GET - Get user preferences
      PUT - Update preferences

  /email-templates
    GET - List available templates
    GET    /{id}
    POST - Create custom template

# Integrations
  /integrations
    GET - List available integrations
    POST - Install integration
    GET    /{id}
    DELETE/{id} - Uninstall
    /{id}/authorize - GET (OAuth flow)
    /{id}/webhook - POST (receive webhook)
    /webhooks
      GET - List configured webhooks
      POST - Create webhook
      GET    /{id}
      DELETE/{id}
      /{id}/test - POST send test

# AI Assistant
  /ai
    /chat
      POST - Send message to AI
      GET  - Get conversation history
    /suggest
      GET  - Get next-step suggestions
    /generate
      POST - Generate document/content
    /analyze
      POST - Analyze data/patterns
    /predict
      POST - Predictive analytics

# Audit & Compliance
  /audit-logs
    GET - List activity logs
    /export - GET full audit trail (admin)

  /compliance
    GET - Compliance status
    /documents - GET compliance docs
    /policies - GET active policies

# Subscription & Billing
  /billing
    GET - Current subscription
    /usage - GET current usage vs limits
    /plans - GET available plans
    /upgrade - POST change plan
    /cancel - POST cancel subscription
    /invoices - GET list of invoices
    /payment-method - GET/PUT payment details
    /portal - POST redirect to Stripe portal

# System Health
  /health
    GET - System status
    /metrics - GET performance metrics
```

### Authentication Flow
```
Client Request
    ↓
API Gateway
    ↓
Extract JWT Token from Authorization header
    ↓
Verify Token Signature (using shared secret)
    ↓
Check Token Expiration
    ↓
Extract user_id, tenant_id from JWT claims
    ↓
Load Tenant Context (settings, features)
    ↓
Execute Endpoint Handler
    ↓
All queries filtered by tenant_id (RLS)
    ↓
Check RBAC permissions for resource/action
    ↓
If allowed: Execute, log to audit_log, respond
If denied: 403 Forbidden
```

### Rate Limiting Strategy
- Per-tenant: 10,000 requests/hour (configurable by plan)
- Per-user: 5,000 requests/hour
- Per-IP: 1,000 requests/hour (prevents DDoS)
- Burst allowance: 100 requests/minute
- Endpoint-specific limits (e.g., /ai/chat: 50/hour)
- Rate limit headers in response: X-RateLimit-Remaining, X-RateLimit-Reset

---

## PART 5: SECURITY ARCHITECTURE

### Identity & Access Management (IAM)
```
┌─────────────────────────────────┐
│   User Authentication (Supabase) │
│   - Email/Password (argon2i)    │
│   - Passkeys (WebAuthn)         │
│   - OAuth 2.0 (Google, GitHub)  │
└──────────────┬──────────────────┘
               │
        ┌──────▼──────┐
        │ JWT Token   │
        │ (HS256 sig) │
        │ exp: 1 hour │
        │ refresh: 7d │
        └──────┬──────┘
               │
┌──────────────▼───────────────────┐
│ RBAC Layer (via Policies)        │
│ - Resource: CRM, Document, etc.  │
│ - Action: read, write, delete    │
│ - Role: owner, admin, manager    │
│ - Policy evaluation at API layer │
└──────────────┬──────────────────┘
               │
        ┌──────▼──────┐
        │ Data Access │
        │ (RLS rules) │
        └─────────────┘
```

### Data Security
- **Encryption at Rest:** AES-256 (Supabase)
- **Encryption in Transit:** TLS 1.3 (all connections)
- **API Key Management:** Encrypted secrets, rotation policy
- **Database Passwords:** Never in code, loaded from environment
- **Sensitive Fields:** PII masked in logs, hashed where possible

### Secrets Management
- Stripe API keys, Supabase anon key in `.env.local` (never committed)
- Tenant API keys stored encrypted in DB
- Key rotation every 90 days
- Audit log for all key access

### DDoS & Rate Limiting
- CloudFlare DDoS protection (if deployed on Vercel)
- Token bucket rate limiting per tenant/user/IP
- Exponential backoff for retries
- Blocking after repeated violations

### OAuth 2.0 for Integrations
```
User clicks "Connect Slack"
    ↓
Redirect to Slack OAuth URL
    ↓
User authorizes
    ↓
Slack redirects to /integrations/slack/callback?code=...
    ↓
Backend exchanges code for access token
    ↓
Access token stored encrypted in DB
    ↓
Background worker syncs Slack messages to Notifications
```

### Compliance & Data Residency
- **GDPR:** Right to be forgotten implemented
- **SOC 2:** Audit logs, access controls
- **ISO 27001:** Encryption, access management
- **Data Residency:** Tenants can choose US, EU, APAC regions
- **Backups:** Daily backups retained for 30 days, encrypted

---

## PART 6: AI ARCHITECTURE (Operationally Intelligent Core)

### AI Learning Loop
```
┌─────────────────────────────────┐
│   User Behavior & Interactions  │
│   - CRM actions                 │
│   - Workflow executions         │
│   - Feedback & ratings          │
└──────────────┬──────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Event Stream Processing │
        │ (Kafka / event logs)    │
        └──────┬──────────────────┘
               │
    ┌──────────▼──────────────┐
    │ Feature Engineering     │
    │ - User patterns         │
    │ - Business metrics      │
    │ - Trend analysis        │
    └──────┬──────────────────┘
           │
    ┌──────▼──────────┐
    │ Model Training  │
    │ (Weekly batch)  │
    │ (Fine-tuning)   │
    └──────┬──────────┘
           │
    ┌──────▼──────────────────────┐
    │ LLM Inference               │
    │ (Claude, GPT-4, Custom)     │
    │ - Context: Company data     │
    │ - RAG: Knowledge base       │
    │ - Reasoning: Multi-step     │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Recommendations & Actions   │
    │ - Next steps (CRM)          │
    │ - Workflow suggestions      │
    │ - Anomaly alerts            │
    │ - Predictive insights       │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ User Feedback Loop          │
    │ - User accepts/rejects      │
    │ - Rating (1-5 stars)        │
    │ - Execution feedback        │
    └──────┬──────────────────────┘
           │
    └──────┬──────────────────────┐
           (Continuous learning)   │
           └────────────────────────┘
```

### AI Capabilities

**1. Conversation & Chat**
- Natural language interface for CRM/data
- Context-aware (knows current user, account, deal)
- RAG (Retrieval Augmented Generation) from knowledge base
- Multi-turn conversations with history
- Example: "What's the status of XYZ deal?" → System retrieves opportunity data, returns answer

**2. Recommendations & Suggestions**
- Next steps in deal: "Contact has been quiet 5 days, consider a follow-up call"
- Workflow suggestions: "Auto-create task for X when new lead arrives"
- Upsell opportunities: "Customer is 80% through contract term, suggest renewal discussion"
- Risk alerts: "Churn risk: Customer's usage dropped 40% week-over-week"

**3. Content Generation**
- Email drafts: "Generate follow-up email to contact at ABC Corp"
- Document generation: Templates + AI for custom contracts/proposals
- Meeting notes synthesis: Summarize meeting transcripts
- Report generation: Custom analytics reports on demand

**4. Predictive Analytics**
- Deal close probability: ML model predicts likelihood of winning
- Revenue forecast: Forecasts Q3 revenue based on pipeline
- Customer churn risk: Identifies at-risk accounts
- Lead scoring: Scores new leads by conversion likelihood
- Growth predictions: Projects growth based on historical patterns

**5. Anomaly Detection**
- Unusual spending patterns
- Unexpected customer behavior changes
- Security threats (multiple failed login attempts)
- System performance degradation
- Data quality issues

### LLM Integration Pattern
```
Request from User
    ↓
Load Tenant Context (settings, data schema)
    ↓
Load User Context (permissions, recent activity)
    ↓
Build Prompt with:
  - System message (role, capabilities)
  - Context (relevant company/account/deal data)
  - User message
  - Conversation history (if multi-turn)
    ↓
Call LLM (Claude/GPT-4)
    ↓
Parse Response
    ↓
Validate Output Against Policies
  - Check permissions
  - Check data access
  - Check action feasibility
    ↓
Execute Action (if approved) or Return Recommendation
    ↓
Log AI Interaction (for learning)
    ↓
Store User Feedback (for refinement)
    ↓
Return Result to User
```

### Fine-Tuning Strategy
- Industry-specific fine-tuning (healthcare, manufacturing, agriculture)
- Tenant-specific fine-tuning (custom terminology, processes)
- Role-specific fine-tuning (what advice matters for each role)
- Continuous refinement from user feedback & results

### Model Selection
- **Default:** Claude 3.5 Sonnet (best reasoning & cost balance)
- **For Complex Analysis:** GPT-4 Turbo
- **Custom/Proprietary:** Fine-tuned models on customer data
- **Fallback:** Local open-source models if API fails

---

## PART 7: INTEGRATION ARCHITECTURE

### Third-Party Integration Pattern
```
┌──────────────────────────────────┐
│  External Services (Slack, GitHub)│
└──────────────┬───────────────────┘
               │
        ┌──────▼──────────┐
        │ OAuth 2.0 Flow  │
        │ (User authorizes)
        └──────┬──────────┘
               │
    ┌──────────▼──────────────┐
    │ Store Access Token      │
    │ (Encrypted in DB)       │
    └──────┬──────────────────┘
           │
    ┌──────▼───────────────────┐
    │ Sync Service             │
    │ - Bidirectional sync     │
    │ - Real-time webhooks     │
    │ - Periodic polling       │
    └──────┬───────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Data Transformation     │
    │ (Normalize to schema)   │
    └──────┬──────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Store in DB             │
    │ (Audit trail)           │
    └──────────────────────────┘
```

### Supported Integrations (Phase 1)
- **Slack:** Receive notifications, send CRM updates, AI chat in Slack
- **Gmail/Outlook:** Email sync to activities/contacts
- **Stripe:** Payment webhook events → Notifications
- **Zapier:** Trigger workflows from external events
- **GitHub:** Commit/PR notifications → Activities
- **HubSpot:** CRM data sync (import/export)
- **Salesforce:** Data sync (future)

### Webhook Management
```
User creates webhook to GitHub
    ↓
Store webhook URL + secret key (encrypted)
    ↓
GitHub sends POST to our webhook endpoint
    ↓
Verify HMAC signature
    ↓
Transform GitHub data → DIGIT format
    ↓
Trigger workflow (if configured)
    ↓
Send notification to user
    ↓
Log event to audit trail
```

---

## PART 8: SCALING STRATEGY

### Horizontal Scaling (for growth)
- **API Servers:** Load-balanced across 2+ instances
- **Database:** PostgreSQL with read replicas for analytics queries
- **Cache:** Redis cluster for session store & rate limiting
- **Search:** Elasticsearch cluster for full-text search
- **Queue:** RabbitMQ cluster for async jobs
- **Storage:** Vercel Blob (globally distributed)

### Vertical Scaling (single tenant large-scale)
- Dedicated database instances for large tenants (> $50k/year)
- Separate analytics warehouse (ClickHouse)
- CDN caching for reports & dashboards
- Query optimization & indexing tuning

### Database Optimization
- Table partitioning by tenant_id (shard by tenant)
- Time-series data to ClickHouse (for analytics)
- Archive old data to S3 (data retention > 1 year)
- Query caching with Redis
- Connection pooling with PgBouncer

### Performance Targets
- API response time: < 200ms (p95)
- Search latency: < 500ms
- Report generation: < 5 seconds (cached), < 30 seconds (fresh)
- AI suggestions: < 2 seconds
- Dashboard load: < 1 second

### Cost Optimization
- Reserved capacity for baseline load
- Spot instances for batch jobs
- Automatic scaling up/down based on demand
- Data compression for historical records
- CDN caching for static assets (dashboards, reports)

---

## PART 9: MODULE DEPENDENCY MATRIX

```
                              Depends On
┌─────────────────────────────────────────────────────────────────────────┐
│ Module                    │ Direct Dependencies                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Multi-Tenant Architecture │ (Foundation - no deps)                      │
│ Authentication            │ Multi-Tenant, Encryption                    │
│ RBAC Permissions          │ Authentication, Users                       │
│ Audit Logging             │ Authentication, RBAC, All Modules           │
│ Monitoring & Reliability  │ Audit Logging, Metrics                      │
│ Encryption & Secrets      │ (Foundation)                                │
│                                                                          │
│ Universal Search          │ All Modules (data sources)                  │
│ Analytics Engine          │ Events, Audit Logs, All Modules             │
│ Knowledge Base            │ Documents, User Feedback                    │
│                                                                          │
│ AI Assistant              │ Knowledge Base, Analytics, Universal Search │
│ Workflow Automation       │ AI Assistant, RBAC, Notifications           │
│                                                                          │
│ Customer CRM              │ RBAC, Notifications, Audit Logging          │
│ Investor CRM              │ RBAC, Notifications, Audit Logging          │
│ Document Management       │ RBAC, Encryption, Universal Search          │
│                                                                          │
│ Reporting Engine          │ Analytics, Audit Logs, RBAC                 │
│ Subscription Billing      │ Authentication, Tenant Management           │
│                                                                          │
│ Legal & Compliance        │ Audit Logging, Subscription, Data Retention │
│ Data Retention            │ Audit Logging, Legal & Compliance           │
│ Feedback Management       │ Authentication, Analytics                   │
│                                                                          │
│ Integration Hub           │ RBAC, Workflow Automation                   │
│ Localization System       │ Multi-Tenant (transparent)                  │
│ Notification System       │ Authentication, RBAC, All Modules           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PART 10: RECOMMENDED BUILD ORDER (PHASES)

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Core infrastructure for multi-tenant SaaS

1. ✅ Multi-Tenant Architecture (tenant isolation, context propagation)
2. ✅ Authentication (email/password, sessions, JWT)
3. ✅ Database schema design & initial setup
4. ✅ API Gateway with RBAC middleware
5. ✅ Basic user management & RBAC roles
6. ✅ Encryption & secrets management
7. ✅ Audit Logging foundation

**Deliverable:** Secure multi-tenant platform with user auth & permissions

---

### Phase 2: Core Business (Weeks 5-8)
**Goal:** CRM functionality & basic workflow

8. ✅ Customer CRM (Accounts, Contacts, Opportunities, Activities)
9. ✅ Investor CRM (Companies, Investors, Cap Table, Funding Rounds)
10. ✅ Notifications & Email delivery
11. ✅ Subscription Billing & Stripe integration
12. ✅ Document Management & file storage
13. ✅ Basic Analytics & dashboard
14. ✅ Monitoring & system health

**Deliverable:** Fully functional CRM + billing for small teams

---

### Phase 3: Intelligence Layer (Weeks 9-12)
**Goal:** AI-powered insights & automation

15. ✅ Analytics Engine (events, metrics, real-time aggregation)
16. ✅ Knowledge Base (articles, documentation)
17. ✅ Universal Search (full-text + semantic)
18. ✅ AI Assistant Infrastructure (LLM integration, RAG)
19. ✅ AI Suggestions & Recommendations
20. ✅ Feedback Management (user feedback → learning)

**Deliverable:** Smart CRM with AI recommendations

---

### Phase 4: Automation & Workflows (Weeks 13-15)
**Goal:** Workflow automation & integration hub

21. ✅ Workflow Automation (BPMN, state machines, triggers)
22. ✅ Integration Hub (OAuth, webhooks)
23. ✅ Slack, Gmail, Zapier integrations
24. ✅ Webhook receiver & event processing

**Deliverable:** Fully automated enterprise workflows

---

### Phase 5: Governance & Compliance (Weeks 16-18)
**Goal:** Legal, compliance, and data management

25. ✅ Legal & Compliance (contracts, policies, documentation)
26. ✅ Data Retention & GDPR compliance
27. ✅ Reporting Engine (custom reports, exports)
28. ✅ Audit report generation
29. ✅ Compliance dashboard

**Deliverable:** Enterprise-grade compliance & auditing

---

### Phase 6: Localization & Scale (Weeks 19-20)
**Goal:** Global expansion & performance

30. ✅ Localization System (languages, timezones, currencies)
31. ✅ Performance optimization & caching
32. ✅ Scaling strategy implementation
33. ✅ Load testing & optimization
34. ✅ Multi-region deployment

**Deliverable:** Production-ready, globally scalable platform

---

### Phase 7: Advanced Features (Ongoing)
**Goal:** Continuous enhancement & market differentiation

35. Predictive Analytics (churn risk, revenue forecasting)
36. Advanced AI (custom models, fine-tuning)
37. API Marketplace (partner integrations)
38. Mobile apps (iOS, Android)
39. Advanced Analytics (cohort analysis, attribution)

---

## PART 11: TECHNOLOGY STACK SUMMARY

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI:** Shadcn/ui, Tailwind CSS, Framer Motion
- **State:** SWR (data fetching), Context API
- **Charts:** Recharts, shadcn/ui charts
- **Search:** Client-side + server-side search UI

### Backend
- **Runtime:** Node.js (Next.js API Routes)
- **Framework:** Next.js + Fastify (optional microservices)
- **Language:** TypeScript
- **Auth:** Supabase Auth (email/password, passkeys)
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis (sessions, rate limiting)
- **Search:** Elasticsearch/Meilisearch
- **Message Queue:** PostgreSQL NOTIFY or RabbitMQ
- **Blob Storage:** Vercel Blob (documents, files)
- **Payments:** Stripe (checkout, subscriptions, webhooks)

### AI/ML
- **LLM:** Claude 3.5 Sonnet (primary), GPT-4 Turbo (fallback)
- **RAG:** LangChain / LlamaIndex
- **Embeddings:** OpenAI Embeddings or Cohere
- **Fine-Tuning:** Custom models per tenant/industry
- **Analytics:** TensorFlow (offline model training)

### DevOps
- **Hosting:** Vercel (serverless)
- **Domain:** Vercel managed DNS
- **CI/CD:** GitHub Actions
- **Monitoring:** Vercel Analytics, Sentry
- **Logging:** Vercel Logs, structured logging to PostgreSQL
- **Backup:** Supabase backups (automated)

---

## PART 12: SECURITY CHECKLIST

### Authentication & Authorization
- [ ] Supabase Auth configured with email verification
- [ ] JWT token validation on all endpoints
- [ ] RBAC policies enforced at API & database layers
- [ ] Passkey/WebAuthn enabled for passwordless auth
- [ ] MFA/2FA available for sensitive operations
- [ ] Session timeout after 1 hour inactivity

### Data Security
- [ ] Database encryption at rest (AES-256)
- [ ] TLS 1.3 for all data in transit
- [ ] API keys never logged or exposed
- [ ] PII masked in logs & audit trails
- [ ] Encryption for sensitive fields (passwords, API keys)
- [ ] Row-Level Security (RLS) on all tables

### Network Security
- [ ] API rate limiting per tenant/user/IP
- [ ] DDoS protection (CloudFlare)
- [ ] CORS configured per tenant
- [ ] HTTPS enforced
- [ ] CSP headers set
- [ ] X-Frame-Options to prevent clickjacking

### Compliance & Auditing
- [ ] Audit logging for all user actions
- [ ] GDPR right-to-be-forgotten implemented
- [ ] Data retention policies enforced
- [ ] SOC 2 controls documented
- [ ] Regular security audits
- [ ] Incident response plan

### Code Security
- [ ] No secrets in code (environment variables)
- [ ] Regular dependency updates
- [ ] OWASP Top 10 mitigations
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized inputs)
- [ ] CSRF tokens for state-changing requests

---

## PART 13: OPERATIONAL EXCELLENCE

### Monitoring & Observability
```
Metrics Collected:
├── System Metrics
│   ├── CPU, Memory, Disk usage
│   ├── Database connections
│   ├── API response times (p50, p95, p99)
│   ├── Error rates (500s, 400s)
│   └── Throughput (requests/sec)
├── Business Metrics
│   ├── Active users
│   ├── Revenue (MRR)
│   ├── Feature usage
│   ├── Churn rate
│   └── NPS score
└── AI Metrics
    ├── AI recommendation accuracy
    ├── User feedback rating
    ├── Model inference latency
    └── Token usage & cost
```

### Alerting Strategy
- Critical (page): API down, database down, 50%+ error rate
- High (alert): API latency > 1000ms, 10%+ error rate
- Medium (digest): Failed integrations, high memory usage
- Low (log): Non-critical errors, warnings

### Deployment & Rollback
- Blue-green deployments (zero downtime)
- Automatic rollback on error rate spike
- Feature flags for gradual rollout
- Database migration testing before prod

---

## PART 14: BUSINESS MODEL & PRICING TIERS

### Free Tier
- Up to 5 users
- 50 MB storage
- Basic CRM features
- No API access
- Limited support

### Professional ($99/month)
- Up to 50 users
- 100 GB storage
- Full CRM + Analytics
- API access
- Email support
- AI suggestions

### Enterprise ($999+/month)
- Unlimited users
- Unlimited storage
- All features
- Dedicated API rate limits
- Priority support (SLA)
- Custom integrations
- Advanced AI features
- On-prem deployment option

### Usage-Based Add-Ons
- AI assistant tokens (overages: $0.01/1000 tokens)
- API calls (overages: $0.01/1000 calls)
- Storage (overages: $0.10/GB/month)
- Premium integrations ($50-500/month each)

---

## PART 15: SUCCESS METRICS & KPIs

### Product KPIs
- Daily Active Users (DAU)
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- NPS Score (target: 50+)
- Feature adoption rate

### Platform KPIs
- API uptime (target: 99.99%)
- API latency p95 (target: < 200ms)
- Error rate (target: < 0.1%)
- Page load time (target: < 1s)
- Database query p95 (target: < 50ms)

### AI KPIs
- AI recommendation accuracy (target: 80%+)
- User acceptance rate of recommendations
- Time saved per user (target: 2+ hours/week)
- Workflow automation success rate

---

## CONCLUSION

The DIGIT Master Specification v1.0 defines a comprehensive, enterprise-grade platform architecture for operationally intelligent AI-integrated business systems. The specification prioritizes:

1. **Security:** Multi-layered access control, encryption, compliance
2. **Scalability:** Microservices, horizontal scaling, data partitioning
3. **Intelligence:** Continuous learning, feedback loops, predictive capabilities
4. **Reliability:** High availability, monitoring, incident response
5. **Integration:** Third-party connectors, webhooks, API-first design
6. **User Experience:** Intuitive UI, AI-assisted workflows, real-time insights

**The build order prioritizes foundation, business value, then intelligence and scale.**

This specification is the source of truth for all implementation decisions. Any deviation requires architectural review and approval.

**Next Steps:** Begin Phase 1 implementation following this specification exactly.

---

**Document Version:** v1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Prepared by:** v0 AI Architect  
**Date:** June 10, 2026
