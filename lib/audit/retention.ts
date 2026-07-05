
import { createServiceClient } from '@/lib/supabase/service'
import { logAuthEvent } from '@/lib/auth/audit'

// Retention policy interface
export interface RetentionPolicy {
  id: string
  organization_id: string
  retention_period_days: number
  apply_to: 'all' | 'auth' | 'document' | 'crm' | 'billing' | 'system'
  is_active: boolean
  created_at: string
  updated_at: string
}

// Default retention policies
export const DEFAULT_RETENTION_POLICIES: Omit<RetentionPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[] = [
  {
    retention_period_days: 365, // 1 year
    apply_to: 'all',
    is_active: true
  },
  {
    retention_period_days: 90, // 3 months
    apply_to: 'auth',
    is_active: true
  },
  {
    retention_period_days: 180, // 6 months
    apply_to: 'document',
    is_active: true
  }
]

// Get retention policy for an organization
export async function getRetentionPolicy(organizationId: string): Promise<RetentionPolicy[]> {
  try {
    const supabase = await createServiceClient()
    
    // Get organization-specific retention policies
    const { data, error } = await supabase
      .from('audit_retention_policies')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('[AuditRetention] Error fetching retention policies:', error)
      // Return default policies if none exist
      return DEFAULT_RETENTION_POLICIES.map((policy, index) => ({
        id: `default-${index}`,
        organization_id: organizationId,
        ...policy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    }
    
    // If no policies exist, create default ones
    if (!data || data.length === 0) {
      const { data: createdPolicies, error: createError } = await supabase
        .from('audit_retention_policies')
        .insert(
          DEFAULT_RETENTION_POLICIES.map(policy => ({
            organization_id: organizationId,
            ...policy
          }))
        )
        .select()
      
      if (createError) {
        console.error('[AuditRetention] Error creating default policies:', createError)
        return DEFAULT_RETENTION_POLICIES.map((policy, index) => ({
          id: `default-${index}`,
          organization_id: organizationId,
          ...policy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      }
      
      return createdPolicies || []
    }
    
    return data
  } catch (err) {
    console.error('[AuditRetention] Unexpected error:', err)
    // Return default policies on error
    return DEFAULT_RETENTION_POLICIES.map((policy, index) => ({
      id: `default-${index}`,
      organization_id: organizationId,
      ...policy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  }
}

// Save retention policy for an organization
export async function saveRetentionPolicy(
  organizationId: string,
  policies: Omit<RetentionPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[]
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // First, delete existing policies
    const { error: deleteError } = await supabase
      .from('audit_retention_policies')
      .delete()
      .eq('organization_id', organizationId)
    
    if (deleteError) {
      console.error('[AuditRetention] Error deleting existing policies:', deleteError)
      return false
    }
    
    // Then, insert new policies
    const { error: insertError } = await supabase
      .from('audit_retention_policies')
      .insert(
        policies.map(policy => ({
          organization_id: organizationId,
          ...policy
        }))
      )
    
    if (insertError) {
      console.error('[AuditRetention] Error saving retention policies:', insertError)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[AuditRetention] Unexpected error:', err)
    return false
  }
}

// Run retention cleanup for an organization
export async function runRetentionCleanup(organizationId: string): Promise<{
  success: boolean
  deletedCount: number
  error?: string
}> {
  try {
    const supabase = await createServiceClient()
    
    // Get retention policies
    const policies = await getRetentionPolicy(organizationId)
    
    if (policies.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        error: 'No retention policies found'
      }
    }
    
    let totalDeleted = 0
    
    // Apply each policy
    for (const policy of policies) {
      if (!policy.is_active) continue
      
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_period_days)
      
      // Build query based on policy scope
      let query = supabase
        .from('audit_logs')
        .delete()
        .eq('organization_id', organizationId)
        .lt('created_at', cutoffDate.toISOString())
      
      // Apply scope filter if not 'all'
      if (policy.apply_to !== 'all') {
        query = query.eq('resource_type', policy.apply_to)
      }
      
      // Execute deletion
      const { count, error } = await query
      
      if (error) {
        console.error(`[AuditRetention] Error applying policy ${policy.id}:`, error)
        continue
      }
      
      totalDeleted += count || 0
    }
    
    // Log audit event
    await logAuthEvent({
      action: 'audit.retention_cleanup',
      organizationId,
      resourceType: 'audit',
      metadata: {
        deletedCount: totalDeleted,
        retentionPoliciesApplied: policies.length
      }
    })
    
    return {
      success: true,
      deletedCount: totalDeleted
    }
  } catch (err) {
    console.error('[AuditRetention] Unexpected error:', err)
    return {
      success: false,
      deletedCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

// Schedule regular retention cleanup
export async function scheduleRetentionCleanup() {
  try {
    const supabase = await createServiceClient()
    
    // Get all organizations
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id')
    
    if (error || !organizations) {
      console.error('[AuditRetention] Error fetching organizations:', error)
      return false
    }
    
    // Run cleanup for each organization
    for (const org of organizations) {
      try {
        const result = await runRetentionCleanup(org.id)
        console.log(`[AuditRetention] Cleanup for org ${org.id}: ${result.deletedCount} logs deleted`)
      } catch (err) {
        console.error(`[AuditRetention] Error running cleanup for org ${org.id}:`, err)
      }
    }
    
    return true
  } catch (err) {
    console.error('[AuditRetention] Error scheduling retention cleanup:', err)
    return false
  }
}

// Get retention cleanup history
export async function getRetentionHistory(
  organizationId: string,
  limit: number = 10
): Promise<Array<{
  id: string
  organization_id: string
  deleted_count: number
  retention_policies_applied: number
  created_at: string
}>> {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('audit_retention_history')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('[AuditRetention] Error fetching retention history:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('[AuditRetention] Unexpected error:', err)
    return []
  }
}