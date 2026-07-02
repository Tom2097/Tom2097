"use client"

import { logException } from "@/lib/logging-client"

// Client-side utility functions for subscription lifecycle

export async function isWithinRefundWindowClient(organizationId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/billing/subscription/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund-window', organizationId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to check refund window')
    }
    
    const result = await response.json()
    return result.withinWindow
  } catch (err) {
    logException(err as Error, { action: 'refund-window-check' })
    return false
  }
}

export async function getYearlyMilestoneClient(organizationId: string): Promise<{
  monthsSinceStart: number
  reminderDue: boolean
  canCancel: boolean
}> {
  try {
    const response = await fetch('/api/v1/billing/subscription/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'yearly-milestone', organizationId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to check yearly milestone')
    }
    
    return await response.json()
  } catch (err) {
    logException(err as Error, { action: 'yearly-milestone-check' })
    return { monthsSinceStart: 0, reminderDue: false, canCancel: false }
  }
}

export async function acknowledgeYearlyReminderClient(organizationId: string): Promise<void> {
  try {
    await fetch('/api/v1/billing/subscription/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge-reminder', organizationId }),
    })
  } catch (err) {
    logException(err as Error, { action: 'acknowledge-reminder' })
  }
}