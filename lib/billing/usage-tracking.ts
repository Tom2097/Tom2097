
import { createServiceClient } from '@/lib/supabase/service'
import { logAuthEvent } from '@/lib/auth/audit'
import { type SubscriptionPlan } from './types'

// Usage types for metered billing
export type UsageType =
  | 'ai_chat'
  | 'ai_analysis'
  | 'ai_generation'
  | 'ai_training'
  | 'ai_deployment'
  | 'ai_prediction'
  | 'document_processing'
  | 'ocr_processing'
  | 'nlp_analysis'
  | 'workflow_execution'
  | 'data_ingestion'
  | 'search_queries'
  | 'crm_operations'
  | 'support_tickets'

// Usage record interface
export interface UsageRecord {
  id: string
  organization_id: string
  user_id: string | null
  usage_type: UsageType
  quantity: number
  metadata: Record<string, unknown>
  created_at: string
}

// Usage limits by plan
export const USAGE_LIMITS: Record<SubscriptionPlan, Record<UsageType, number>> = {
  free: {
    ai_chat: 50,
    ai_analysis: 20,
    ai_generation: 10,
    ai_training: 5,
    ai_deployment: 2,
    ai_prediction: 50,
    document_processing: 50,
    ocr_processing: 10,
    nlp_analysis: 20,
    workflow_execution: 50,
    data_ingestion: 100,
    search_queries: 200,
    crm_operations: 500,
    support_tickets: 10
  },
  pro: {
    ai_chat: 500,
    ai_analysis: 200,
    ai_generation: 100,
    ai_training: 20,
    ai_deployment: 5,
    ai_prediction: 200,
    document_processing: 500,
    ocr_processing: 100,
    nlp_analysis: 200,
    workflow_execution: 500,
    data_ingestion: 1000,
    search_queries: 2000,
    crm_operations: 5000,
    support_tickets: 100
  },
  enterprise: {
    ai_chat: -1, // Unlimited
    ai_analysis: -1,
    ai_generation: -1,
    ai_training: -1,
    ai_deployment: -1,
    ai_prediction: -1,
    document_processing: -1,
    ocr_processing: -1,
    nlp_analysis: -1,
    workflow_execution: -1,
    data_ingestion: -1,
    search_queries: -1,
    crm_operations: -1,
    support_tickets: -1
  }
}

// Track usage of a feature
export async function trackUsage(
  organizationId: string,
  userId: string | null,
  usageType: UsageType,
  quantity: number = 1,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // Record the usage
    const { error } = await supabase.from('usage_records').insert({
      organization_id: organizationId,
      user_id: userId,
      usage_type: usageType,
      quantity,
      metadata
    })
    
    if (error) {
      console.error(`[UsageTracking] Error tracking usage for ${usageType}:`, error)
      return false
    }
    
    // Log audit event
    await logAuthEvent({
      action: `billing.usage_recorded`,
      organizationId,
      userId,
      resourceType: "usage",
      resourceId: usageType,
      metadata: {
        usageType,
        quantity,
        ...metadata
      }
    })
    
    return true
  } catch (err) {
    console.error(`[UsageTracking] Unexpected error tracking usage for ${usageType}:`, err)
    return false
  }
}

// Check if organization has exceeded usage limits
export async function checkUsageLimits(organizationId: string): Promise<{
  hasExceeded: boolean
  exceededLimits: Array<{
    usageType: UsageType
    currentUsage: number
    limit: number
    percentage: number
  }>
  usage: Record<UsageType, number>
}> {
  try {
    const supabase = await createServiceClient()
    
    // Get organization subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('organization_id', organizationId)
      .single()
    
    if (subError || !subscription) {
      console.error('[UsageTracking] Error fetching subscription:', subError)
      return {
        hasExceeded: false,
        exceededLimits: [],
        usage: Object.fromEntries(Object.keys(USAGE_LIMITS.free).map(key => [key, 0])) as Record<UsageType, number>
      }
    }
    
    const plan = subscription.plan as SubscriptionPlan
    const limits = USAGE_LIMITS[plan] || USAGE_LIMITS.free
    
    // Get current usage for this billing period
    const startOfPeriod = new Date()
    startOfPeriod.setDate(1) // Start of current month
    
    const { data: usageData, error: usageError } = await supabase
      .from('usage_records')
      .select('usage_type, quantity')
      .eq('organization_id', organizationId)
      .gte('created_at', startOfPeriod.toISOString())
    
    if (usageError) {
      console.error('[UsageTracking] Error fetching usage records:', usageError)
      return {
        hasExceeded: false,
        exceededLimits: [],
        usage: Object.fromEntries(Object.keys(limits).map(key => [key, 0])) as Record<UsageType, number>
      }
    }
    
    // Calculate total usage by type
    const usage: Record<UsageType, number> = Object.fromEntries(
      Object.keys(limits).map(key => [key, 0])
    ) as Record<UsageType, number>
    
    usageData.forEach(record => {
      const usageType = record.usage_type as UsageType
      usage[usageType] = (usage[usageType] || 0) + record.quantity
    })
    
    // Check for exceeded limits
    const exceededLimits = []
    let hasExceeded = false
    
    for (const [usageType, limit] of Object.entries(limits)) {
      const currentUsage = usage[usageType as UsageType]
      const percentage = limit > 0 ? Math.round((currentUsage / limit) * 100) : 0
      
      if (limit > 0 && currentUsage > limit) {
        hasExceeded = true
        exceededLimits.push({
          usageType: usageType as UsageType,
          currentUsage,
          limit,
          percentage
        })
      }
    }
    
    return {
      hasExceeded,
      exceededLimits,
      usage
    }
  } catch (err) {
    console.error('[UsageTracking] Unexpected error checking usage limits:', err)
    return {
      hasExceeded: false,
      exceededLimits: [],
      usage: Object.fromEntries(Object.keys(USAGE_LIMITS.free).map(key => [key, 0])) as Record<UsageType, number>
    }
  }
}

// Get usage statistics for an organization
export async function getUsageStatistics(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalUsage: number
  usageByType: Record<UsageType, number>
  usageOverTime: Array<{
    date: string
    usage: number
  }>
}> {
  try {
    const supabase = await createServiceClient()
    
    // Get usage by type
    const { data: usageByTypeData, error: typeError } = await supabase
      .from('usage_records')
      .select('usage_type, quantity')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
    
    if (typeError) {
      console.error('[UsageTracking] Error fetching usage by type:', typeError)
      throw new Error('Failed to fetch usage statistics')
    }
    
    // Get usage over time
    const { data: usageOverTimeData, error: timeError } = await supabase
      .from('usage_records')
      .select('created_at, quantity')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })
    
    if (timeError) {
      console.error('[UsageTracking] Error fetching usage over time:', timeError)
      throw new Error('Failed to fetch usage statistics')
    }
    
    // Calculate usage by type
    const usageByType: Record<UsageType, number> = Object.fromEntries(
      Object.keys(USAGE_LIMITS.free).map(key => [key, 0])
    ) as Record<UsageType, number>
    
    usageByTypeData.forEach(record => {
      const usageType = record.usage_type as UsageType
      usageByType[usageType] = (usageByType[usageType] || 0) + record.quantity
    })
    
    // Calculate total usage
    const totalUsage = Object.values(usageByType).reduce((sum, val) => sum + val, 0)
    
    // Group usage by date
    const usageOverTimeMap: Record<string, number> = {}
    
    usageOverTimeData.forEach(record => {
      const date = new Date(record.created_at).toISOString().split('T')[0]
      usageOverTimeMap[date] = (usageOverTimeMap[date] || 0) + record.quantity
    })
    
    const usageOverTime = Object.entries(usageOverTimeMap).map(([date, usage]) => ({
      date,
      usage
    })).sort((a, b) => a.date.localeCompare(b.date))
    
    return {
      totalUsage,
      usageByType,
      usageOverTime
    }
  } catch (err) {
    console.error('[UsageTracking] Unexpected error getting usage statistics:', err)
    throw new Error('Failed to get usage statistics')
  }
}

// Reset usage for a new billing period
export async function resetUsageForNewPeriod(organizationId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // This would be called at the start of a new billing period
    // For now, we don't need to do anything as we query by date range
    return true
  } catch (err) {
    console.error('[UsageTracking] Error resetting usage for new period:', err)
    return false
  }
}