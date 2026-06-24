import { generateText, streamText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { queryTimeseries, queryBreakdown, querySummary } from "./engine"
import { detectInsights } from "./insight-engine"
import { detectAnomalies } from "./anomaly-detection"
import { segmentCustomers } from "./customer-segments"
import type { TimeseriesPoint, BreakdownRow, AnalyticsSummary } from "./types"
import type { Insight } from "./insight-engine"
import type { DetectedAnomaly } from "./anomaly-detection"
import type { SegmentResult } from "./customer-segments"

/**
 * Module #7.5: AI-Powered Report Generation.
 * 
 * Generates comprehensive, human-readable analytics reports
 * using AI to interpret data, identify patterns, and provide
 * actionable recommendations. Supports multiple report types
 * and formats (Markdown, HTML, JSON).
 */

// Report types
export type ReportType = 
  | "daily_summary"
  | "weekly_summary"
  | "monthly_summary"
  | "performance_report"
  | "customer_analysis"
  | "trend_analysis"
  | "anomaly_report"
  | "segment_analysis"
  | "custom"

// Report formats
export type ReportFormat = "markdown" | "html" | "json" | "plain"

// Report section types
export type ReportSectionType = 
  | "overview"
  | "key_metrics"
  | "trends"
  | "insights"
  | "anomalies"
  | "segments"
  | "recommendations"
  | "deep_dive"
  | "executive_summary"

export interface ReportSection {
  id: string
  type: ReportSectionType
  title: string
  content: string
  data?: any
  order: number
}

export interface ReportTemplate {
  id: string
  name: string
  description: string
  type: ReportType
  sections: ReportSectionType[]
  defaultOptions: ReportOptions
}

export interface ReportOptions {
  /** Report type */
  type?: ReportType
  /** Time period for the report */
  period?: { start: string; end: string }
  /** Focus metrics */
  focusMetrics?: string[]
  /** Include sections */
  includeSections?: ReportSectionType[]
  /** Exclude sections */
  excludeSections?: ReportSectionType[]
  /** Format for output */
  format?: ReportFormat
  /** Template to use */
  templateId?: string
  /** Custom prompt for AI */
  customPrompt?: string
  /** Include raw data */
  includeData?: boolean
  /** Depth of analysis */
  depth?: "brief" | "standard" | "comprehensive"
  /** Tone of the report */
  tone?: "professional" | "casual" | "technical" | "executive"
}

export interface GeneratedReport {
  id: string
  organizationId: string
  type: ReportType
  title: string
  generatedAt: string
  period: { start: string; end: string }
  format: ReportFormat
  sections: ReportSection[]
  summary: string
  insights: Insight[]
  anomalies: DetectedAnomaly[]
  segments?: SegmentResult[]
  data?: {
    timeseries?: Record<string, TimeseriesPoint[]>
    breakdowns?: Record<string, BreakdownRow[]>
    summaries?: Record<string, AnalyticsSummary>
  }
  metadata: {
    generationTime: number
    modelUsed: string
    confidence: number
  }
}

const DEFAULT_OPTIONS: Required<Omit<ReportOptions, "type" | "period">> = {
  focusMetrics: [],
  includeSections: [],
  excludeSections: [],
  format: "markdown",
  templateId: "default",
  customPrompt: "",
  includeData: false,
  depth: "standard",
  tone: "professional",
}

/**
 * Default report templates
 */
const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: "default",
    name: "Default Report",
    description: "Comprehensive analytics report with all sections",
    type: "performance_report",
    sections: [
      "executive_summary",
      "key_metrics",
      "trends",
      "insights",
      "anomalies",
      "recommendations",
    ],
    defaultOptions: {
      ...DEFAULT_OPTIONS,
      format: "markdown",
      depth: "standard",
      tone: "professional",
    },
  },
  {
    id: "daily_summary",
    name: "Daily Summary",
    description: "Quick daily performance overview",
    type: "daily_summary",
    sections: [
      "executive_summary",
      "key_metrics",
      "insights",
      "recommendations",
    ],
    defaultOptions: {
      ...DEFAULT_OPTIONS,
      format: "markdown",
      depth: "brief",
      tone: "casual",
    },
  },
  {
    id: "executive_briefing",
    name: "Executive Briefing",
    description: "High-level overview for executives",
    type: "performance_report",
    sections: [
      "executive_summary",
      "key_metrics",
      "recommendations",
    ],
    defaultOptions: {
      ...DEFAULT_OPTIONS,
      format: "markdown",
      depth: "brief",
      tone: "executive",
    },
  },
  {
    id: "technical_analysis",
    name: "Technical Analysis",
    description: "Detailed technical breakdown with raw data",
    type: "trend_analysis",
    sections: [
      "overview",
      "key_metrics",
      "trends",
      "anomalies",
      "deep_dive",
    ],
    defaultOptions: {
      ...DEFAULT_OPTIONS,
      format: "markdown",
      depth: "comprehensive",
      tone: "technical",
      includeData: true,
    },
  },
  {
    id: "customer_focus",
    name: "Customer Analysis",
    description: "Focus on customer segments and behavior",
    type: "customer_analysis",
    sections: [
      "executive_summary",
      "segments",
      "insights",
      "recommendations",
    ],
    defaultOptions: {
      ...DEFAULT_OPTIONS,
      format: "markdown",
      depth: "standard",
      tone: "professional",
    },
  },
]

/**
 * Get report template by ID
 */
export function getReportTemplate(templateId: string): ReportTemplate | null {
  return DEFAULT_TEMPLATES.find(t => t.id === templateId) || DEFAULT_TEMPLATES[0]
}

/**
 * Get all available templates
 */
export function getAllTemplates(): ReportTemplate[] {
  return [...DEFAULT_TEMPLATES]
}

/**
 * Build system prompt for report generation based on options
 */
function buildReportSystemPrompt(options: ReportOptions): string {
  const toneInstructions = {
    professional: "Write in a professional, business-appropriate tone. Use clear, concise language.",
    casual: "Write in a friendly, approachable tone. Be conversational but still informative.",
    technical: "Write in a technical, detailed tone. Include specific metrics and data points.",
    executive: "Write in a high-level, strategic tone. Focus on business impact and outcomes.",
  }

  const depthInstructions = {
    brief: "Keep the report concise and to the point. Focus on key insights only.",
    standard: "Provide a balanced level of detail with clear insights and supporting data.",
    comprehensive: "Be thorough and detailed. Include all relevant data, analysis, and context.",
  }

  return `${BASE_SYSTEM_PROMPT}

You are an expert analytics report writer. Generate a ${options.depth || "standard"} analytics report.

${toneInstructions[options.tone || "professional"]}
${depthInstructions[options.depth || "standard"]}

Format your response as ${options.format || "Markdown"} with clear sections, headings, and structure.
Use bullet points, lists, and formatting to make the report easy to read and understand.

Always include:
- Clear section headings
- Key metrics and data points
- Insights and interpretations
- Actionable recommendations

For Markdown format, use:
- # for main titles
- ## for section titles  
- ### for subsection titles
- **bold** for emphasis
- *italics* for notes
- - for bullet points
- --- for horizontal rules

For HTML format, use proper HTML tags.
For JSON format, return a structured JSON object.
For plain format, use plain text with clear formatting.

Be specific, data-driven, and actionable. Avoid vague statements. Always tie insights back to the data.`
}

/**
 * Generate a report section using AI
 */
async function generateReportSection(
  sectionType: ReportSectionType,
  data: {
    organizationId: string
    period: { start: string; end: string }
    timeseries?: Record<string, TimeseriesPoint[]>
    breakdowns?: Record<string, BreakdownRow[]>
    summaries?: Record<string, AnalyticsSummary>
    insights?: Insight[]
    anomalies?: DetectedAnomaly[]
    segments?: SegmentResult[]
  },
  options: ReportOptions
): Promise<ReportSection> {
  const startTime = Date.now()

  // Build section-specific prompt
  let sectionPrompt = ""
  
  switch (sectionType) {
    case "overview":
      sectionPrompt = `Provide a high-level overview of the analytics data for the period ${data.period.start} to ${data.period.end}. Summarize the overall performance and key highlights.`
      break
    
    case "key_metrics":
      sectionPrompt = `List and explain the key metrics from the data. Include total events, unique users, revenue, conversion rates, and any other important KPIs. Provide context for each metric.`
      break
    
    case "trends":
      sectionPrompt = `Analyze and describe the key trends in the data. Identify patterns over time, growth or decline in metrics, and any notable changes. Use the timeseries data to support your analysis.`
      break
    
    case "insights":
      sectionPrompt = `Based on the data and detected insights, provide the most important insights and findings. Explain what these insights mean for the business and why they matter.`
      break
    
    case "anomalies":
      sectionPrompt = `Describe any anomalies or unusual patterns detected in the data. Explain what might have caused them and their potential impact.`
      break
    
    case "segments":
      sectionPrompt = `Analyze the customer segments and describe their characteristics. Identify high-value segments, at-risk segments, and opportunities for growth.`
      break
    
    case "recommendations":
      sectionPrompt = `Based on all the data, insights, and analysis, provide actionable recommendations. Be specific about what actions to take, when, and what the expected impact might be.`
      break
    
    case "deep_dive":
      sectionPrompt = `Provide a deep dive analysis into the most interesting or important aspects of the data. Explore patterns, correlations, and insights that might not be immediately obvious.`
      break
    
    case "executive_summary":
      sectionPrompt = `Write an executive summary that captures the most important findings, insights, and recommendations. This should be a high-level overview suitable for leadership.`
      break
    
    default:
      sectionPrompt = `Provide analysis and insights for ${sectionType}.`
  }

  // Add data context
  sectionPrompt += "\n\n"
  
  if (data.summaries) {
    sectionPrompt += "Summary data:\n"
    for (const [metric, summary] of Object.entries(data.summaries)) {
      sectionPrompt += `- ${metric}: ${JSON.stringify(summary)}\n`
    }
    sectionPrompt += "\n"
  }

  if (data.insights && data.insights.length > 0) {
    sectionPrompt += `Detected insights (${data.insights.length}):\n`
    for (const insight of data.insights.slice(0, 5)) {
      sectionPrompt += `- ${insight.type}: ${insight.title} (confidence: ${insight.confidence}%)\n`
    }
    sectionPrompt += "\n"
  }

  if (data.anomalies && data.anomalies.length > 0) {
    sectionPrompt += `Detected anomalies (${data.anomalies.length}):\n`
    for (const anomaly of data.anomalies.slice(0, 3)) {
      sectionPrompt += `- ${anomaly.type} on ${anomaly.bucket}: value=${anomaly.value}, severity=${anomaly.severity}\n`
    }
    sectionPrompt += "\n"
  }

  // Generate section content
  const systemPrompt = buildReportSystemPrompt(options)

  const result = await generateText({
    model: options.depth === "comprehensive" ? DEFAULT_CHAT_MODEL : FAST_MODEL,
    system: systemPrompt,
    prompt: `Write the "${sectionType}" section of the report:\n\n${sectionPrompt}`,
    temperature: 0.3,
    maxOutputTokens: options.depth === "comprehensive" ? 2000 : 1000,
  })

  const section: ReportSection = {
    id: `${sectionType}_${Date.now()}`,
    type: sectionType,
    title: formatSectionTitle(sectionType, options.tone || "professional"),
    content: result.text,
    data: options.includeData ? data : undefined,
    order: getSectionOrder(sectionType),
  }

  return section
}

/**
 * Format section title based on type and tone
 */
function formatSectionTitle(sectionType: ReportSectionType, tone: string): string {
  const titles: Record<ReportSectionType, Record<string, string>> = {
    overview: {
      professional: "Overview",
      casual: "What Happened",
      technical: "Data Overview",
      executive: "High-Level Overview",
    },
    key_metrics: {
      professional: "Key Metrics",
      casual: "The Numbers",
      technical: "Performance Metrics",
      executive: "Key Performance Indicators",
    },
    trends: {
      professional: "Trends Analysis",
      casual: "What's Changing",
      technical: "Time Series Analysis",
      executive: "Trends & Patterns",
    },
    insights: {
      professional: "Key Insights",
      casual: "What We Learned",
      technical: "Data Insights",
      executive: "Strategic Insights",
    },
    anomalies: {
      professional: "Anomalies & Outliers",
      casual: "Unusual Activity",
      technical: "Anomaly Detection",
      executive: "Notable Deviations",
    },
    segments: {
      professional: "Customer Segments",
      casual: "Customer Groups",
      technical: "Segmentation Analysis",
      executive: "Audience Segmentation",
    },
    recommendations: {
      professional: "Recommendations",
      casual: "What to Do Next",
      technical: "Actionable Insights",
      executive: "Strategic Recommendations",
    },
    deep_dive: {
      professional: "Deep Dive",
      casual: "Let's Dig Deeper",
      technical: "Detailed Analysis",
      executive: "In-Depth Analysis",
    },
    executive_summary: {
      professional: "Executive Summary",
      casual: "The Big Picture",
      technical: "Summary",
      executive: "Executive Brief",
    },
  }

  return titles[sectionType]?.[tone] || sectionType.replace(/_/g, " ")
}

/**
 * Get the order for report sections
 */
function getSectionOrder(sectionType: ReportSectionType): number {
  const order: Record<ReportSectionType, number> = {
    executive_summary: 0,
    overview: 1,
    key_metrics: 2,
    trends: 3,
    insights: 4,
    anomalies: 5,
    segments: 6,
    deep_dive: 7,
    recommendations: 8,
  }
  return order[sectionType] ?? 99
}

/**
 * Get sections to include based on options
 */
function getSectionsToInclude(
  type: ReportType,
  includeSections: ReportSectionType[],
  excludeSections: ReportSectionType[],
  templateId: string
): ReportSectionType[] {
  // Get template sections
  const template = getReportTemplate(templateId)
  const templateSections = template?.sections || DEFAULT_TEMPLATES[0].sections

  // Get default sections for type
  const typeSections: Record<ReportType, ReportSectionType[]> = {
    daily_summary: ["executive_summary", "key_metrics", "insights", "recommendations"],
    weekly_summary: ["executive_summary", "key_metrics", "trends", "insights", "recommendations"],
    monthly_summary: ["executive_summary", "key_metrics", "trends", "insights", "anomalies", "recommendations"],
    performance_report: ["executive_summary", "key_metrics", "trends", "insights", "anomalies", "recommendations"],
    customer_analysis: ["executive_summary", "segments", "insights", "recommendations"],
    trend_analysis: ["executive_summary", "key_metrics", "trends", "insights", "anomalies", "deep_dive"],
    anomaly_report: ["executive_summary", "anomalies", "insights", "recommendations"],
    segment_analysis: ["executive_summary", "segments", "insights", "recommendations"],
    custom: [...templateSections],
  }

  // Start with type-specific sections
  let sections: ReportSectionType[] = [...(typeSections[type] || templateSections)]

  // Add explicitly included sections
  if (includeSections.length > 0) {
    for (const section of includeSections) {
      if (!sections.includes(section)) {
        sections.push(section)
      }
    }
  }

  // Remove excluded sections
  if (excludeSections.length > 0) {
    sections = sections.filter(s => !excludeSections.includes(s))
  }

  // Deduplicate and sort by order
  const uniqueSections = Array.from(new Set(sections))
  uniqueSections.sort((a, b) => getSectionOrder(a) - getSectionOrder(b))

  return uniqueSections
}

/**
 * Collect all necessary data for report generation
 */
async function collectReportData(
  organizationId: string,
  period: { start: string; end: string },
  focusMetrics: string[],
  includeData: boolean
): Promise<{
  timeseries?: Record<string, TimeseriesPoint[]>
  breakdowns?: Record<string, BreakdownRow[]>
  summaries?: Record<string, AnalyticsSummary>
  insights?: Insight[]
  anomalies?: DetectedAnomaly[]
  segments?: SegmentResult[]
}> {
  const data: {
    timeseries?: Record<string, TimeseriesPoint[]>
    breakdowns?: Record<string, BreakdownRow[]>
    summaries?: Record<string, AnalyticsSummary>
    insights?: Insight[]
    anomalies?: DetectedAnomaly[]
    segments?: SegmentResult[]
  } = {}

  try {
    // Get summary for the period
    const summary = await querySummary(organizationId, period.start, period.end)
    data.summaries = { overall: summary }

    // Get timeseries for focus metrics or default metrics
    const metrics = focusMetrics.length > 0 ? focusMetrics : ["purchase", "user_signup", "page_view", "session_start"]
    data.timeseries = {}

    for (const metric of metrics) {
      try {
        const points = await queryTimeseries(organizationId, {
          type: "timeseries",
          event_name: metric,
          aggregate: "count",
          granularity: "day",
          start: period.start,
          end: period.end,
        })
        data.timeseries![metric] = points
      } catch (error) {
        console.error(`[AI Reports] Error fetching timeseries for ${metric}:`, error)
      }
    }

    // Get breakdowns for key dimensions
    data.breakdowns = {}
    for (const metric of metrics.slice(0, 3)) { // Limit to first 3 for performance
      try {
        const breakdown = await queryBreakdown(organizationId, {
          type: "breakdown",
          event_name: metric,
          aggregate: "count",
          dimension: "event_category",
          start: period.start,
          end: period.end,
          limit: 10,
        })
        data.breakdowns![metric] = breakdown
      } catch (error) {
        console.error(`[AI Reports] Error fetching breakdown for ${metric}:`, error)
      }
    }

    // Detect insights
    data.insights = (await detectInsights(organizationId, {
      focusMetrics: metrics,
      trendLookbackDays: Math.floor((new Date(period.end).getTime() - new Date(period.start).getTime()) / (1000 * 60 * 60 * 24)),
    })).insights

    // Detect anomalies for focus metrics
    data.anomalies = []
    for (const metric of metrics.slice(0, 2)) { // Limit for performance
      try {
        const anomalyResult = await detectAnomalies(organizationId, metric, period, {
          methods: ["zscore", "rolling_avg"],
          useAI: false,
        })
        data.anomalies.push(...anomalyResult.anomalies)
      } catch (error) {
        console.error(`[AI Reports] Error detecting anomalies for ${metric}:`, error)
      }
    }

    // Get customer segments
    if (includeData) {
      const segmentsResult = await segmentCustomers(organizationId, {
        useAI: false,
      })
      data.segments = segmentsResult.segments
    }

  } catch (error) {
    console.error("[AI Reports] Error collecting report data:", error)
  }

  return data
}

/**
 * Generate a full report
 */
export async function generateReport(
  organizationId: string,
  options: ReportOptions = {}
): Promise<GeneratedReport> {
  const startTime = Date.now()
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Determine period
  let period = opts.period
  if (!period) {
    // Default to last 30 days
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    period = { start, end }
  }

  // Determine type
  const type = opts.type || "performance_report"

  // Get sections to include
  const sections = getSectionsToInclude(
    type,
    opts.includeSections!,
    opts.excludeSections!,
    opts.templateId!
  )

  // Collect data
  const data = await collectReportData(
    organizationId,
    period,
    opts.focusMetrics!,
    opts.includeData!
  )

  // Generate title
  const title = generateReportTitle(type, period, opts.tone || "professional")

  // Generate summary
  const summary = await generateReportSummary(data, type, opts)

  // Generate each section
  const reportSections: ReportSection[] = []
  
  for (const sectionType of sections) {
    try {
      const section = await generateReportSection(sectionType, { organizationId, period, ...data }, opts)
      reportSections.push(section)
    } catch (error) {
      console.error(`[AI Reports] Error generating section ${sectionType}:`, error)
      // Add error section
      reportSections.push({
        id: `${sectionType}_error_${Date.now()}`,
        type: sectionType,
        title: formatSectionTitle(sectionType, opts.tone || "professional"),
        content: `Error generating this section: ${error instanceof Error ? error.message : "Unknown error"}`,
        order: getSectionOrder(sectionType),
      })
    }
  }

  // Sort sections by order
  reportSections.sort((a, b) => a.order - b.order)

  // Calculate generation time
  const generationTime = Date.now() - startTime

  const report: GeneratedReport = {
    id: `report_${Date.now()}`,
    organizationId,
    type,
    title,
    generatedAt: new Date().toISOString(),
    period,
    format: opts.format || "markdown",
    sections: reportSections,
    summary,
    insights: data.insights || [],
    anomalies: data.anomalies || [],
    segments: data.segments,
    data: opts.includeData ? data : undefined,
    metadata: {
      generationTime,
      modelUsed: opts.depth === "comprehensive" ? DEFAULT_CHAT_MODEL : FAST_MODEL,
      confidence: 85, // Placeholder - could be calculated from section confidence
    },
  }

  return report
}

/**
 * Generate report title based on type and period
 */
function generateReportTitle(
  type: ReportType,
  period: { start: string; end: string },
  tone: string
): string {
  const startDate = new Date(period.start)
  const endDate = new Date(period.end)

  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

  const titles: Record<ReportType, (start: Date, end: Date) => string> = {
    daily_summary: () => `Daily Analytics Summary - ${formatDate(endDate)}`,
    weekly_summary: () => `Weekly Analytics Summary - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    monthly_summary: () => `Monthly Analytics Summary - ${formatDate(startDate).split(",")[0]}`,
    performance_report: () => `Performance Report - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    customer_analysis: () => `Customer Analysis Report - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    trend_analysis: () => `Trend Analysis Report - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    anomaly_report: () => `Anomaly Report - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    segment_analysis: () => `Customer Segment Analysis - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    custom: () => `Analytics Report - ${formatDate(startDate)} to ${formatDate(endDate)}`,
  }

  return titles[type]?.(startDate, endDate) || `Analytics Report - ${formatDate(startDate)} to ${formatDate(endDate)}`
}

/**
 * Generate a concise summary for the report
 */
async function generateReportSummary(
  data: {
    timeseries?: Record<string, TimeseriesPoint[]>
    breakdowns?: Record<string, BreakdownRow[]>
    summaries?: Record<string, AnalyticsSummary>
    insights?: Insight[]
    anomalies?: DetectedAnomaly[]
    segments?: SegmentResult[]
  },
  type: ReportType,
  options: ReportOptions
): Promise<string> {
  try {
    const systemPrompt = buildReportSystemPrompt(options)

    // Build summary prompt
    let summaryPrompt = `Write a concise summary for a ${type} report. `
    summaryPrompt += `Include the most important findings, key metrics, and top insights. `
    summaryPrompt += `This summary will appear at the beginning of the report.\n\n`

    // Add key data points
    if (data.summaries?.overall) {
      const s = data.summaries.overall
      summaryPrompt += `Key metrics: ${s.total_events.toLocaleString()} total events, ${s.unique_users.toLocaleString()} unique users, ${s.distinct_events} distinct events, $${s.total_value.toLocaleString()} total value\n`
    }

    if (data.insights && data.insights.length > 0) {
      summaryPrompt += `Key insights: ${data.insights.slice(0, 3).map(i => i.title).join(", ")}\n`
    }

    if (data.anomalies && data.anomalies.length > 0) {
      const criticalCount = data.anomalies.filter(a => a.severity === "critical").length
      const highCount = data.anomalies.filter(a => a.severity === "high").length
      summaryPrompt += `Anomalies detected: ${data.anomalies.length} total (${criticalCount} critical, ${highCount} high)\n`
    }

    if (data.segments && data.segments.length > 0) {
      const topSegment = data.segments[0]
      summaryPrompt += `Top customer segment: ${topSegment.segment.name} with ${topSegment.count} customers and $${topSegment.totalMonetary.toLocaleString()} total value\n`
    }

    const result = await generateText({
      model: FAST_MODEL,
      system: systemPrompt,
      prompt: summaryPrompt,
      temperature: 0.2,
      maxOutputTokens: 500,
    })

    return result.text

  } catch (error) {
    console.error("[AI Reports] Error generating summary:", error)
    return "This report provides a comprehensive analysis of your analytics data, including key metrics, trends, insights, and actionable recommendations."
  }
}

/**
 * Generate a report in a specific format
 */
export async function generateFormattedReport(
  organizationId: string,
  format: ReportFormat,
  options: ReportOptions = {}
): Promise<string> {
  const report = await generateReport(organizationId, { ...options, format })

  return formatReport(report, format)
}

/**
 * Format a report in the specified format
 */
export function formatReport(report: GeneratedReport, format: ReportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(report, null, 2)
    
    case "html":
      return formatAsHTML(report)
    
    case "plain":
      return formatAsPlainText(report)
    
    case "markdown":
    default:
      return formatAsMarkdown(report)
  }
}

/**
 * Format report as Markdown
 */
function formatAsMarkdown(report: GeneratedReport): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${report.title}`)
  lines.push(``)
  lines.push(`*Generated on ${new Date(report.generatedAt).toLocaleString()} | ${report.metadata.generationTime}ms`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Summary
  lines.push(`## Executive Summary`)
  lines.push(``)
  lines.push(report.summary)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Period
  lines.push(`**Period:** ${report.period.start} to ${report.period.end}`)
  lines.push(`**Report Type:** ${report.type}`)
  lines.push(`**Model:** ${report.metadata.modelUsed}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Sections
  for (const section of report.sections) {
    lines.push(`## ${section.title}`)
    lines.push(``)
    lines.push(section.content)
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  }

  // Appendices
  if (report.data) {
    lines.push(`## Appendix: Data`)
    lines.push(``)
    
    if (report.data.summaries) {
      lines.push(`### Summary Metrics`)
      lines.push(``)
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      for (const [metric, summary] of Object.entries(report.data.summaries)) {
        lines.push(`| ${metric} | ${JSON.stringify(summary)} |`)
      }
      lines.push(``)
    }
    
    lines.push(`---`)
  }

  return lines.join("\n")
}

/**
 * Format report as HTML
 */
function formatAsHTML(report: GeneratedReport): string {
  const sectionsHtml = report.sections.map(section => `
    <section class="report-section">
      <h2>${section.title}</h2>
      <div class="section-content">${section.content.replace(/\n/g, "<br>")}</div>
    </section>
  `).join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #111; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #222; margin-top: 24px; }
    .report-section { margin-bottom: 32px; }
    .section-content { margin-top: 16px; }
    .report-meta { color: #666; font-size: 0.9em; }
    hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p class="report-meta">Generated on ${new Date(report.generatedAt).toLocaleString()} | ${report.metadata.generationTime}ms</p>
  
  <p><strong>Period:</strong> ${report.period.start} to ${report.period.end}</p>
  <p><strong>Report Type:</strong> ${report.type} | <strong>Model:</strong> ${report.metadata.modelUsed}</p>
  
  <hr>
  
  <section class="report-section">
    <h2>Executive Summary</h2>
    <div class="section-content">${report.summary.replace(/\n/g, "<br>")}</div>
  </section>
  
  <hr>
  
  ${sectionsHtml}
  
  <hr>
  <p class="report-meta">Generated by DigiT AI Analytics</p>
</body>
</html>`
}

/**
 * Format report as plain text
 */
function formatAsPlainText(report: GeneratedReport): string {
  const lines: string[] = []

  // Title
  lines.push(`=${report.title}`)
  lines.push(``)
  lines.push(`Generated on ${new Date(report.generatedAt).toLocaleString()} (${report.metadata.generationTime}ms)`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Summary
  lines.push(`EXECUTIVE SUMMARY`)
  lines.push(`---`)
  lines.push(report.summary)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Metadata
  lines.push(`Period: ${report.period.start} to ${report.period.end}`)
  lines.push(`Report Type: ${report.type}`)
  lines.push(`Model: ${report.metadata.modelUsed}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // Sections
  for (const section of report.sections) {
    lines.push(`${section.title.toUpperCase()}`)
    lines.push(`---`)
    lines.push(section.content)
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  }

  return lines.join("\n")
}

/**
 * Generate a quick insight report (streaming version)
 */
export async function* streamReport(
  organizationId: string,
  options: ReportOptions = {}
): AsyncGenerator<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const type = opts.type || "performance_report"

  // Determine period
  let period = opts.period
  if (!period) {
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    period = { start, end }
  }

  // Get basic data
  const summary = await querySummary(organizationId, period.start, period.end)
  const insights = (await detectInsights(organizationId, {
    trendLookbackDays: Math.floor((new Date(period.end).getTime() - new Date(period.start).getTime()) / (1000 * 60 * 60 * 24)),
  })).insights.slice(0, 5)

  // Stream sections
  yield `# ${generateReportTitle(type, period, opts.tone || "professional")}\n\n`
  yield `*Generated at ${new Date().toLocaleString()}*\n\n`
  yield `---\n\n`

  yield `## Executive Summary\n\n`
  
  // Stream summary
  const summaryStream = await streamText({
    model: FAST_MODEL,
    system: buildReportSystemPrompt(opts),
    prompt: `Write a brief executive summary for a ${type} report covering period ${period.start} to ${period.end}. Key metrics: ${summary.total_events.toLocaleString()} events, ${summary.unique_users.toLocaleString()} users, $${summary.total_value.toLocaleString()} value. Top insights: ${insights.map(i => i.title).join(", ")}.`,
    temperature: 0.2,
    maxOutputTokens: 500,
  })

  for await (const chunk of summaryStream.textStream) {
    yield chunk
  }
  yield `\n\n---\n\n`

  yield `## Key Metrics\n\n`
  yield `- **Total Events:** ${summary.total_events.toLocaleString()}\n`
  yield `- **Unique Users:** ${summary.unique_users.toLocaleString()}\n`
  yield `- **Distinct Events:** ${summary.distinct_events}\n`
  yield `- **Total Value:** $${summary.total_value.toLocaleString()}\n\n`

  yield `---\n\n`
  yield `## Top Insights\n\n`
  
  for (const insight of insights) {
    yield `- **${insight.title}** (${insight.type}, ${insight.confidence}% confidence)\n`
    yield `  ${insight.description}\n\n`
  }
  
  yield `---\n\n`
  yield `_Report generation complete_\n`
}

/**
 * Generate a report with a custom prompt
 */
export async function generateCustomReport(
  organizationId: string,
  customPrompt: string,
  options: ReportOptions = {}
): Promise<GeneratedReport> {
  const opts = { ...DEFAULT_OPTIONS, ...options, customPrompt }

  // Determine period
  let period = opts.period
  if (!period) {
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    period = { start, end }
  }

  // Collect data
  const data = await collectReportData(
    organizationId,
    period,
    opts.focusMetrics!,
    opts.includeData!
  )

  // Generate report using custom prompt
  const systemPrompt = buildReportSystemPrompt(opts)

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: customPrompt,
    temperature: 0.3,
    maxOutputTokens: 4000,
  })

  // Create report structure
  const report: GeneratedReport = {
    id: `custom_report_${Date.now()}`,
    organizationId,
    type: "custom",
    title: `Custom Report - ${new Date().toLocaleDateString()}`,
    generatedAt: new Date().toISOString(),
    period,
    format: opts.format || "markdown",
    sections: [
      {
        id: "custom_content",
        type: "deep_dive",
        title: "Custom Analysis",
        content: result.text,
        order: 0,
      }
    ],
    summary: "Custom report generated based on your specific requirements.",
    insights: data.insights || [],
    anomalies: data.anomalies || [],
    segments: data.segments,
    data: opts.includeData ? data : undefined,
    metadata: {
      generationTime: 0,
      modelUsed: DEFAULT_CHAT_MODEL,
      confidence: 85,
    },
  }

  return report
}

export {
  DEFAULT_TEMPLATES,
}
