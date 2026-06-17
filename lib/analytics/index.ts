/**
 * Module #7: Analytics Engine - Main Exports.
 * 
 * This module provides comprehensive analytics capabilities including:
 * - Basic query execution (timeseries, breakdown, summary)
 * - AI-powered natural language querying
 * - Automated insight detection
 * - Statistical anomaly detection
 * - Customer segmentation (RFM analysis)
 * - AI report generation
 * 
 * All functions are organization-scoped via the organizationId parameter.
 */

// Re-export existing engine functions
export {
  trackEvents,
  queryTimeseries,
  queryBreakdown,
  querySummary,
  runQuery,
  normalizeAggregate,
  normalizeGranularity,
  validateEvent,
} from "./engine"

// Re-export query parsing utilities
export {
  parseQuery,
  toCsv,
} from "./query"

// Re-export types
export type {
  AggregateFn,
  Granularity,
  QueryType,
  KnownDimension,
  EventInput,
  AnalyticsQuery,
  TimeseriesPoint,
  BreakdownRow,
  AnalyticsSummary,
  ReportConfig,
  AnalyticsReport,
} from "./types"
export {
  AGGREGATES,
  GRANULARITIES,
  QUERY_TYPES,
} from "./types"

// AI-Powered Natural Language Querying
export {
  parseNaturalLanguageQuery,
  executeNaturalLanguageQuery,
  validateAIQuery,
  getQuerySuggestions,
} from "./ai-query"
export type { ParsedAIQuery } from "./ai-query"

// Automated Insight Detection
export {
  detectInsights,
  getMetricInsights,
  getTopInsight,
  refreshInsights,
} from "./insight-engine"
export type { 
  Insight,
  InsightType,
  InsightDetectionOptions,
} from "./insight-engine"

// Statistical Anomaly Detection
export {
  detectAnomalies,
  checkForAnomaly,
  getAnomalyStatistics,
  calculateStatistics,
} from "./anomaly-detection"
export type {
  DetectedAnomaly,
  AnomalyDetectionMethod,
  AnomalySeverity,
  AnomalyType,
  AnomalyDetectionOptions,
} from "./anomaly-detection"

// Customer Segmentation (RFM Analysis)
export {
  segmentCustomers,
  getCustomerSegment,
  getRFMDistribution,
  createCustomSegments,
  getSegmentComparison,
  DEFAULT_RFM_SEGMENTS,
  calculateRFMScores,
  assignSegment,
  getRFMCell,
} from "./customer-segments"
export type {
  RFMScore,
  CustomerSegment,
  SegmentCategory,
  CustomerProfile,
  SegmentDefinition,
  SegmentResult,
  SegmentationOptions,
} from "./customer-segments"

// AI Report Generation
export {
  generateReport,
  generateFormattedReport,
  streamReport,
  generateCustomReport,
  formatReport,
  getReportTemplate,
  getAllTemplates,
} from "./ai-reports"
export type {
  ReportType,
  ReportFormat,
  ReportSectionType,
  ReportSection,
  ReportTemplate,
  ReportOptions,
  GeneratedReport,
} from "./ai-reports"

export {
  DEFAULT_TEMPLATES,
} from "./ai-reports"

// Reports management (existing)
export {
  createReport,
  getReports,
  getReport,
  updateReport,
  deleteReport,
  runSavedReport,
} from "./reports"
