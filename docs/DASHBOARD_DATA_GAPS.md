# Dashboard Data Reality Audit

Audit of every dashboard/widget using mock data, and whether a live backend
source already exists. Per the production-readiness directive: where a live
source exists it is used; where none exists the gap is documented rather than
fabricated. No new product features or industry-specific backends were created.

## Live sources that exist today

| Backend | Source | Status |
| --- | --- | --- |
| Subscriptions / plan limits | Supabase `subscriptions` + `profiles` (`lib/products.ts`) | **Live** — dashboard subscription banner, plan/module gating, and usage limits already read real data. |
| Generic event analytics | `analytics_events` + `analytics_event_*` RPCs via `/api/v1/analytics/*` (`lib/analytics/engine.ts`) | **Live API exists.** Returns event counts, unique users, value sums, timeseries, and breakdowns. |
| Monitoring / uptime | `monitors` + `monitor_checks` (`lib/monitoring/engine.ts`) | **Live** — now executed automatically by the scheduled runner (P2). |

## Widgets still on mock data — and why (no live source)

These live in `app/(dashboard)/page.tsx` and `app/(dashboard)/analytics/page.tsx`
and are fed by generators in `lib/mock-data.ts`. They render **domain-specific
semantics that no backend produces**:

| Widget | Mock generator | Gap |
| --- | --- | --- |
| Revenue Forecast (area chart, "Total Revenue YTD", "+38% forecast") | `generateRevenueForecast` | No revenue/finance backend. The analytics engine counts events; it has no concept of revenue, currency, or forecasting. |
| Risk Analysis (risk score by category) | `generateRiskData` | No risk-scoring backend or model exists. |
| Operational Performance (CPU / Memory / Network 24h) | `generateOperationalMetrics` | No infrastructure-metrics ingestion. Monitoring stores up/down/latency per monitor, not host CPU/memory/network time series. |
| Predictive Analytics table (churn, market share, acquisition predictions) | inline mock | No prediction/ML backend. |
| AI Insights panel (hardcoded opportunity/warning/insight cards) | inline mock | Static illustrative copy; no insights-generation backend. |
| Top dashboard stat cards (`dashboardStats`: aiAccuracy, enterpriseClients, etc.) | `dashboardStats` | No backend metric corresponds to these vanity figures. |

### Why these were not "wired"

The generic analytics API (`/api/v1/analytics/*`) **could** populate a generic
event-volume chart, but the current widgets are labeled and shaped for
revenue/risk/infrastructure/prediction semantics. Repointing them at event
counts would mislabel the data (showing event counts under a "$ Revenue" axis),
which is a worse correctness problem than clearly-illustrative placeholder data.
Building revenue, risk, infrastructure-metrics, or prediction backends to back
these widgets is **new feature work**, which is explicitly out of scope.

## Recommended resolution (future, scoped work)

1. Replace the revenue/risk/infra widgets with **generic event-analytics
   widgets** driven by `/api/v1/analytics/*` (timeseries + breakdown + summary),
   relabeled to event semantics ("Events over time", "Top events", "Active
   users"). This is a UI change against an existing live backend.
2. Or, if revenue/risk/infrastructure dashboards are genuinely required, scope
   dedicated ingestion + storage for each domain as separate feature modules.

Until one of those is approved, these widgets remain on clearly-labeled mock
generators and are tracked here as known gaps.
