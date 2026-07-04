import { generateText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { queryTimeseries, queryBreakdown, querySummary } from "./engine"
import type { DataPoint, TimeseriesPoint, BreakdownRow, AnalyticsSummary } from "@/types/analytics"

/**
 * Module #7.2: Automated Insight Detection Engine.
 * 
 * Analyzes analytics data to automatically detect meaningful patterns,
 * trends, anomalies, and correlations without requiring users to know
 * what to look for. Uses statistical analysis and AI to surface insights.
 */

// Types for detected insights
export type InsightType = 
  | "trend_up"
  | "trend_down"
  | "spike"
  | "drop"
  | "seasonality"
  | "correlation"
  | "outlier"
  | "new_record"
  | "milestone"
  | "top_performer"
  | "underperformer"

export interface Insight {
  id: string
  type: InsightType
  title: string
  description: string
  metric: string
  value: number
  previousValue?: number
  change?: number
  changePercentage?: number
  dimension?: string
  dimensionValue?: string
  confidence: number // 0-100
  importance: "high" | "medium" | "low"
  dateRange: {
    start: string
    end: string
  }
  relatedInsights?: string[]
  dataPoints?: DataPoint[]
}

export interface InsightDetectionOptions {
  /** Focus on specific metrics (e.g., ["revenue", "users"]) */
  focusMetrics?: string[]
  /** Minimum change percentage to trigger trend insights */
  minChangePercentage?: number
  /** Confidence threshold (0-100) for including insights */
  minConfidence?: number
  /** Number of top dimensions to analyze */
  topDimensions?: number
  /** Lookback period in days for trend analysis */
  trendLookbackDays?: number
  /** Whether to use AI for deeper insight analysis */
  useAI?: boolean
}

const DEFAULT_OPTIONS: Required<InsightDetectionOptions> = {
  focusMetrics: [],
  minChangePercentage: 10,
  minConfidence: 60,
  topDimensions: 5,
  trendLookbackDays: 30,
  useAI: true,
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(oldValue: number, newValue: number): { change: number; percentage: number } {
  const change = newValue - oldValue
  const percentage = oldValue !== 0 ? (change / Math.abs(oldValue)) * 100 : 0
  return { change, percentage }
}

/**
 * Calculate trend direction and strength from timeseries data
 */
function analyzeTrend(points: TimeseriesPoint[]): {
  direction: "up" | "down" | "stable"
  strength: number
  slope: number
} {
  if (points.length < 2) {
    return { direction: "stable", strength: 0, slope: 0 }
  }

  // Calculate linear regression slope (simplified)
  const n = points.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  
  for (let i = 0; i < points.length; i++) {
    sumX += i
    sumY += points[i].value
    sumXY += i * points[i].value
    sumX2 += i * i
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  
  // Determine direction and strength
  if (slope > 0.05) {
    return { direction: "up", strength: Math.min(slope * 100, 100), slope }
  } else if (slope < -0.05) {
    return { direction: "down", strength: Math.min(Math.abs(slope) * 100, 100), slope }
  } else {
    return { direction: "stable", strength: 0, slope: 0 }
  }
}

/**
 * Detect spikes and drops in timeseries data
 */
function detectAnomalies(points: TimeseriesPoint[], sensitivity: number = 2): Insight[] {
  const anomalies: Insight[] = []
  
  if (points.length < 3) return anomalies
  
  // Calculate mean and standard deviation
  const values = points.map(p => p.value)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  const threshold = sensitivity * stdDev
  
  // Check each point for anomalies
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i]
    const prev = points[i - 1]
    const next = points[i + 1]
    
    const deviation = Math.abs(current.value - mean)
    
    if (deviation > threshold) {
      const changeFromPrev = current.value - prev.value
      const changeToNext = next.value - current.value
      
      const isSpike = changeFromPrev > 0 && changeToNext < 0
      const isDrop = changeFromPrev < 0 && changeToNext > 0
      
      if (isSpike || isDrop) {
        const insight: Insight = {
          id: `anomaly_${current.bucket}_${i}`,
          type: isSpike ? "spike" : "drop",
          title: isSpike ? `Spike detected on ${current.bucket}` : `Drop detected on ${current.bucket}`,
          description: `Value ${isSpike ? 'increased' : 'decreased'} to ${current.value} (${Math.round(calculateChange(prev.value, current.value).percentage)}% change)`,
          metric: "value",
          value: current.value,
          previousValue: prev.value,
          change: changeFromPrev,
          changePercentage: calculateChange(prev.value, current.value).percentage,
          confidence: Math.min(90 + (deviation / stdDev) * 5, 100),
          importance: deviation > threshold * 3 ? "high" : "medium",
          dateRange: {
            start: points[0].bucket,
            end: points[points.length - 1].bucket,
          },
          dataPoints: [prev, current, next] as unknown as DataPoint[],
        }
        anomalies.push(insight)
      }
    }
  }
  
  return anomalies
}

/**
 * Detect trends in timeseries data
 */
function detectTrends(
  points: TimeseriesPoint[],
  metric: string,
  lookbackPoints: number = 5,
  minChangePercentage: number = 10
): Insight[] {
  const trends: Insight[] = []
  
  if (points.length < lookbackPoints + 1) return trends
  
  // Compare recent period vs previous period
  const recent = points.slice(-lookbackPoints)
  const previous = points.slice(-lookbackPoints - lookbackPoints, -lookbackPoints)
  
  const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length
  const previousAvg = previous.reduce((a, b) => a + b.value, 0) / previous.length
  
  const change = calculateChange(previousAvg, recentAvg)
  
  // Only report significant changes
  if (Math.abs(change.percentage) >= minChangePercentage) {
    const trend = analyzeTrend(points.slice(-lookbackPoints * 2))
    
    const insight: Insight = {
      id: `trend_${metric}_${Date.now()}`,
      type: change.percentage > 0 ? "trend_up" : "trend_down",
      title: change.percentage > 0 
        ? `↑ ${metric} trending up` 
        : `↓ ${metric} trending down`,
      description: `${metric} ${change.percentage > 0 ? 'increased' : 'decreased'} by ${Math.abs(change.percentage).toFixed(1)}% (from ${previousAvg.toFixed(1)} to ${recentAvg.toFixed(1)})`,
      metric,
      value: recentAvg,
      previousValue: previousAvg,
      change: change.change,
      changePercentage: change.percentage,
      confidence: Math.min(70 + Math.abs(change.percentage) * 2, 100),
      importance: Math.abs(change.percentage) > 30 ? "high" : "medium",
      dateRange: {
        start: previous[0]?.bucket || points[0].bucket,
        end: recent[recent.length - 1]?.bucket || points[points.length - 1].bucket,
      },
      dataPoints: points.slice(-lookbackPoints * 2) as unknown as DataPoint[],
    }
    trends.push(insight)
  }
  
  return trends
}

/**
 * Detect top and bottom performers from breakdown data
 */
function detectTopPerformers(
  rows: BreakdownRow[],
  metric: string,
  topN: number = 3
): Insight[] {
  const insights: Insight[] = []
  
  if (rows.length === 0) return insights
  
  // Sort by value descending
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, row) => sum + row.value, 0)
  
  // Top performers
  for (let i = 0; i < Math.min(topN, sorted.length); i++) {
    const row = sorted[i]
    const percentage = total > 0 ? (row.value / total) * 100 : 0
    
    if (percentage > 5) { // Only report if significant
      const insight: Insight = {
        id: `top_${metric}_${row.label}_${i}`,
        type: "top_performer",
        title: `🏆 ${row.label} is a top performer`,
        description: `${row.label} contributes ${percentage.toFixed(1)}% to ${metric} (${row.value.toLocaleString()})`,
        metric,
        value: row.value,
        confidence: Math.min(80 + percentage, 100),
        importance: percentage > 20 ? "high" : "medium",
        dateRange: {
          start: "", // Will be set by caller
          end: "",
        },
        dimension: metric,
        dimensionValue: row.label,
      }
      insights.push(insight)
    }
  }
  
  return insights
}

/**
 * Detect correlations between metrics
 */
async function detectCorrelations(
  organizationId: string,
  metrics: string[],
  dateRange: { start: string; end: string }
): Promise<Insight[]> {
  const insights: Insight[] = []
  
  if (metrics.length < 2) return insights
  
  try {
    // Fetch timeseries data for all metrics
    const allSeries: Record<string, TimeseriesPoint[]> = {}
    
    for (const metric of metrics) {
        const points = await queryTimeseries(organizationId, {
          type: "timeseries",
          event_name: metric,
          event_category: "insights",
          aggregate: "count",
          granularity: "day",
          start: dateRange.start,
          end: dateRange.end,
          limit: 1000,
        })
      allSeries[metric] = points
    }
    
    // Calculate correlations (simplified Pearson correlation)
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i]
        const metric2 = metrics[j]
        const series1 = allSeries[metric1]
        const series2 = allSeries[metric2]
        
        if (series1.length === 0 || series2.length === 0 || series1.length !== series2.length) {
          continue
        }
        
        // Calculate Pearson correlation
        const n = series1.length
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0
        
        for (let k = 0; k < n; k++) {
          sum1 += series1[k].value
          sum2 += series2[k].value
          sum1Sq += series1[k].value * series1[k].value
          sum2Sq += series2[k].value * series2[k].value
          pSum += series1[k].value * series2[k].value
        }
        
        const num = pSum - (sum1 * sum2 / n)
        const den = Math.sqrt(
          (sum1Sq - (sum1 * sum1) / n) * 
          (sum2Sq - (sum2 * sum2) / n)
        )
        
        const correlation = den !== 0 ? num / den : 0
        
        // Only report strong correlations
        if (Math.abs(correlation) > 0.7) {
          const insight: Insight = {
            id: `correlation_${metric1}_${metric2}_${Date.now()}`,
            type: "correlation",
            title: correlation > 0 
              ? `↗ ${metric1} correlates with ${metric2}` 
              : `↘ ${metric1} inversely correlates with ${metric2}`,
            description: `${metric1} and ${metric2} have a ${correlation > 0 ? 'positive' : 'negative'} correlation (r = ${correlation.toFixed(2)})`,
            metric: `${metric1}_vs_${metric2}`,
            value: correlation,
            confidence: Math.min(70 + Math.abs(correlation) * 30, 100),
            importance: Math.abs(correlation) > 0.9 ? "high" : "medium",
            dateRange,
          }
          insights.push(insight)
        }
      }
    }
  } catch (error) {
    console.error("[Insight Engine] Error detecting correlations:", error)
  }
  
  return insights
}

/**
 * Use AI to analyze data and suggest additional insights
 */
async function detectAIInsights(
  organizationId: string,
  data: {
    timeseries?: TimeseriesPoint[]
    breakdown?: BreakdownRow[]
    summary?: AnalyticsSummary
  },
  metric: string,
  dateRange: { start: string; end: string }
): Promise<Insight[]> {
  const insights: Insight[] = []
  
  try {
    // Build prompt describing the data
    let dataDescription = `Analyze the following analytics data for metric "${metric}" from ${dateRange.start} to ${dateRange.end}:\n\n`
    
    if (data.timeseries && data.timeseries.length > 0) {
      dataDescription += `Time series data (${data.timeseries.length} points):\n`
      dataDescription += `Values: [${data.timeseries.map(p => p.value).join(', ')}]\n`
      dataDescription += `Buckets: [${data.timeseries.map(p => p.bucket).join(', ')}]\n\n`
    }
    
    if (data.breakdown && data.breakdown.length > 0) {
      dataDescription += `Breakdown data (${data.breakdown.length} rows):\n`
      dataDescription += data.breakdown.map(row => `${row.label}: ${row.value}`).join('\n')
      dataDescription += '\n\n'
    }
    
    if (data.summary) {
      dataDescription += `Summary data:\n`
      dataDescription += Object.entries(data.summary).map(([k, v]) => `${k}: ${v}`).join('\n')
      dataDescription += '\n\n'
    }
    
    const AI_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are an expert data analyst. Based on the provided analytics data, identify 2-3 key insights, patterns, or anomalies.

Return ONLY a JSON array of insight objects with this structure:
[{
  "type": "trend_up" | "trend_down" | "spike" | "drop" | "seasonality" | "correlation" | "outlier" | "new_record" | "milestone",
  "title": "string (max 80 chars)",
  "description": "string (max 200 chars)",
  "metric": "string",
  "value": number,
  "confidence": number (0-100),
  "importance": "high" | "medium" | "low"
}]

Be specific, data-driven, and concise. Focus on actionable insights.`
    
    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: AI_SYSTEM_PROMPT,
      prompt: dataDescription,
      temperature: 0.3,
      maxOutputTokens: 1500,
    })
    
    // Parse AI response
    try {
      const responseText = result.text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const insight: Insight = {
              id: `ai_${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: item.type as InsightType || "trend_up",
              title: item.title || "AI Detected Insight",
              description: item.description || "",
              metric: item.metric || metric,
              value: item.value || 0,
              confidence: item.confidence || 70,
              importance: item.importance || "medium",
              dateRange,
            }
            insights.push(insight)
          }
        }
      }
    } catch (error) {
      console.error("[Insight Engine] Error parsing AI response:", error)
    }
    
  } catch (error) {
    console.error("[Insight Engine] Error in AI insight detection:", error)
  }
  
  return insights
}

/**
 * Main function to detect insights from analytics data
 */
export async function detectInsights(
  organizationId: string,
  options: InsightDetectionOptions = {}
): Promise<{ insights: Insight[]; summary: { total: number; high: number; medium: number; low: number } }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const allInsights: Insight[] = []
  
  // Get current date range
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - opts.trendLookbackDays * 24 * 60 * 60 * 1000).toISOString()
  
  const dateRange = { start: startDate, end: endDate }
  
  try {
    // 1. Get summary data for overall metrics
    const analyticsSummary = await querySummary(organizationId, startDate, endDate)
    
    // Detect insights from summary
    if (analyticsSummary.total_events > 0) {
      const eventInsight: Insight = {
        id: `summary_events_${Date.now()}`,
        type: "milestone",
        title: `📊 ${analyticsSummary.total_events.toLocaleString()} total events`,
        description: `${analyticsSummary.unique_users.toLocaleString()} unique users, ${analyticsSummary.distinct_events} distinct event types`,
        metric: "events",
        value: analyticsSummary.total_events,
        confidence: 90,
        importance: "high",
        dateRange,
      }
      allInsights.push(eventInsight)
    }
    
    // 2. Get timeseries for key metrics
    const keyMetrics = opts.focusMetrics.length > 0 ? opts.focusMetrics : ["purchase", "user_signup", "page_view", "session_start"]
    
    for (const metric of keyMetrics) {
      try {
        // Get timeseries data
         const points = await queryTimeseries(organizationId, {
           type: "timeseries",
           event_name: metric,
           event_category: "insights",
           aggregate: "count",
           granularity: "day",
           start: startDate,
           end: endDate,
           limit: 1000,
         })
        
        if (points.length > 1) {
          // Detect trends
          const trendInsights = detectTrends(points, metric, 5, opts.minChangePercentage!)
          allInsights.push(...trendInsights)
          
          // Detect anomalies
          const anomalyInsights = detectAnomalies(points, 2)
          allInsights.push(...anomalyInsights)
          
          // AI insights
          if (opts.useAI) {
            const aiInsights = await detectAIInsights(organizationId, { timeseries: points }, metric, dateRange)
            allInsights.push(...aiInsights)
          }
        }
        
        // Get breakdown data
         const breakdown = await queryBreakdown(organizationId, {
           type: "breakdown",
           event_name: metric,
           event_category: "insights",
           aggregate: "count",
           dimension: "event_category",
           start: startDate,
           end: endDate,
           limit: opts.topDimensions!,
           granularity: "day",
         })
        
        if (breakdown.length > 0) {
          // Detect top performers
          const topInsights = detectTopPerformers(breakdown, metric, 3)
          allInsights.push(...topInsights)
        }
        
      } catch (error) {
        console.error(`[Insight Engine] Error processing metric ${metric}:`, error)
      }
    }
    
    // 3. Detect correlations between metrics (if we have multiple metrics)
    if (keyMetrics.length > 1) {
      const correlationInsights = await detectCorrelations(organizationId, keyMetrics, dateRange)
      allInsights.push(...correlationInsights)
    }
    
    // 4. Deduplicate insights by type and metric
    const seen = new Set<string>()
    const uniqueInsights = allInsights.filter(insight => {
      const key = `${insight.type}_${insight.metric}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    
    // 5. Filter by confidence and sort by importance
    const filteredInsights = uniqueInsights
      .filter(i => i.confidence >= opts.minConfidence!)
      .sort((a, b) => {
        // Sort by importance first
        const importanceOrder = { high: 3, medium: 2, low: 1 }
        const importanceDiff = importanceOrder[b.importance] - importanceOrder[a.importance]
        if (importanceDiff !== 0) return importanceDiff
        
        // Then by confidence
        return b.confidence - a.confidence
      })
    
    // 6. Limit to reasonable number
    const finalInsights = filteredInsights.slice(0, 20)
    
    // Generate summary statistics
    const insightSummary = {
      total: finalInsights.length,
      high: finalInsights.filter(i => i.importance === "high").length,
      medium: finalInsights.filter(i => i.importance === "medium").length,
      low: finalInsights.filter(i => i.importance === "low").length,
    }
    
    return { insights: finalInsights, summary: insightSummary }
    
  } catch (error) {
    console.error("[Insight Engine] Error detecting insights:", error)
    return { insights: [], summary: { total: 0, high: 0, medium: 0, low: 0 } }
  }
}

/**
 * Get insights for a specific metric
 */
export async function getMetricInsights(
  organizationId: string,
  metric: string,
  options: InsightDetectionOptions = {}
): Promise<Insight[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options, focusMetrics: [metric] }
  const result = await detectInsights(organizationId, opts)
  return result.insights.filter(i => i.metric === metric)
}

/**
 * Get the most important insight for a metric
 */
export async function getTopInsight(
  organizationId: string,
  metric: string,
  options: InsightDetectionOptions = {}
): Promise<Insight | null> {
  const insights = await getMetricInsights(organizationId, metric, options)
  return insights.length > 0 ? insights[0] : null
}

/**
 * Refresh insights for an organization (could be run on a schedule)
 */
export async function refreshInsights(
  organizationId: string,
  options: InsightDetectionOptions = {}
): Promise<{ insights: Insight[]; generatedAt: string }> {
  const result = await detectInsights(organizationId, options)
  return {
    insights: result.insights,
    generatedAt: new Date().toISOString(),
  }
}


