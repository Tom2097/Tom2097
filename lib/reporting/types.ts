/**
 * Module #13: Reporting Engine — shared types.
 *
 * The Reporting Engine sits ABOVE Module #7 (Analytics). A report definition
 * composes multiple sections, each sourced from an existing module
 * (analytics / audit / feedback / documents). Generating a report produces an
 * immutable run snapshot. Scheduling drives recurring generation via the
 * service-role-only get_due_report_schedules() helper.
 */

export const REPORT_SOURCES = ["analytics", "audit", "feedback", "documents"] as const
export type ReportSource = (typeof REPORT_SOURCES)[number]

export const SCHEDULE_FREQUENCIES = ["daily", "weekly", "monthly"] as const
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number]

export const RUN_STATUSES = ["pending", "running", "completed", "failed"] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const RUN_TRIGGERS = ["manual", "scheduled"] as const
export type RunTrigger = (typeof RUN_TRIGGERS)[number]

/**
 * A single section of a report.
 * - analytics: params is an AnalyticsQuery-like object ({ type, event_name, ... }).
 *   `start`/`end` are injected by the engine from the run's time range.
 * - audit/feedback/documents: params is an optional filter bag; the engine
 *   computes summary counts/breakdowns for the run range.
 */
export interface ReportSection {
  key: string
  title: string
  source: ReportSource
  params?: Record<string, unknown>
}

export interface ReportDefinition {
  id: string
  organization_id: string
  name: string
  description: string | null
  sections: ReportSection[]
  range_days: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReportDefinitionInput {
  name: string
  description?: string | null
  sections?: ReportSection[]
  range_days?: number
  is_active?: boolean
}

export interface ReportSchedule {
  id: string
  organization_id: string
  definition_id: string
  frequency: ScheduleFrequency
  hour_utc: number
  is_enabled: boolean
  next_run_at: string
  last_run_at: string | null
  recipients: string[]
  created_at: string
  updated_at: string
}

export interface ReportScheduleInput {
  frequency: ScheduleFrequency
  hour_utc?: number
  is_enabled?: boolean
  recipients?: string[]
}

export interface ReportSectionResult {
  key: string
  title: string
  source: ReportSource
  data: unknown
  error?: string
}

export interface ReportRun {
  id: string
  organization_id: string
  definition_id: string
  status: RunStatus
  trigger: RunTrigger
  range_start: string | null
  range_end: string | null
  result: { sections?: ReportSectionResult[]; [k: string]: unknown }
  error: string | null
  generated_by: string | null
  created_at: string
  completed_at: string | null
}

export interface ListReportsOptions {
  limit?: number
  offset?: number
  activeOnly?: boolean
}
