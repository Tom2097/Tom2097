import {
  QUERY_TYPES,
  type AnalyticsQuery,
  type QueryType,
} from "./types"
import { normalizeAggregate, normalizeGranularity } from "./engine"

/**
 * Module #7: query parsing + CSV serialization helpers.
 * Parsing clamps the time window and enforces sane defaults so a client can
 * never request an unbounded scan.
 */

const MAX_RANGE_DAYS = 365
const DEFAULT_RANGE_DAYS = 30

/** Parse and validate a query from a plain object (JSON body or search params). */
export function parseQuery(input: Record<string, unknown>): [AnalyticsQuery | null, string | null] {
  const type = input.type as QueryType
  if (!QUERY_TYPES.includes(type)) {
    return [null, `type must be one of: ${QUERY_TYPES.join(", ")}`]
  }

  const now = Date.now()
  let end = input.end ? Date.parse(String(input.end)) : now
  let start: number
  if (input.start) {
    start = Date.parse(String(input.start))
  } else {
    const days = Number(input.range_days) || DEFAULT_RANGE_DAYS
    start = end - Math.min(days, MAX_RANGE_DAYS) * 24 * 60 * 60 * 1000
  }
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return [null, "start/end must be valid ISO date strings"]
  }
  if (start >= end) return [null, "start must be before end"]
  // Clamp window length.
  if (end - start > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    start = end - MAX_RANGE_DAYS * 24 * 60 * 60 * 1000
  }

  if (type === "breakdown" && !input.dimension) {
    return [null, "breakdown queries require a dimension"]
  }

  const limitRaw = Number(input.limit)
  const query: AnalyticsQuery = {
    type,
    event_name: (input.event_name as string) ?? null,
    event_category: (input.event_category as string) ?? null,
    aggregate: normalizeAggregate(input.aggregate),
    granularity: normalizeGranularity(input.granularity),
    dimension: input.dimension ? String(input.dimension) : undefined,
    limit: Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 10,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }
  return [query, null]
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialize an array of flat objects to CSV with a header row. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return columns?.join(",") ?? ""
  const cols = columns ?? Object.keys(rows[0])
  const header = cols.map(csvCell).join(",")
  const body = rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")).join("\n")
  return `${header}\n${body}`
}
