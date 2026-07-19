import { validateDiscountCode as validateDiscount } from './discounts'

interface TrialPlan {
  id: string
  name: string
  durationDays: number
  features: string[]
  maxUsers: number
  autoExpire: boolean
}

interface OrganizationTrial {
  orgId: string
  planId: string
  startedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining: number
}

interface FoundingPlan {
  id: string
  name: string
  discountPercent: number
  validUntil: string
  maxSeats: number
  features: string[]
}

interface DiscountCode {
  code: string
  type: 'percentage' | 'fixed'
  value: number
  maxUses: number
  currentUses: number
  expiresAt: string
  applicablePlans: string[]
}

const TRIAL_PLANS: TrialPlan[] = [
  {
    id: 'pro-trial',
    name: 'Pro Trial',
    durationDays: 14,
    features: ['Unlimited documents', 'AI-powered analysis', 'Real-time monitoring', 'API access', 'Priority support'],
    maxUsers: 10,
    autoExpire: true,
  },
  {
    id: 'enterprise-trial',
    name: 'Enterprise Trial',
    durationDays: 30,
    features: ['Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'SLA guarantees', 'Advanced security'],
    maxUsers: 50,
    autoExpire: true,
  },
]

const FOUNDING_PLANS: FoundingPlan[] = [
  {
    id: 'founding-pro',
    name: 'Founding Pro',
    discountPercent: 30,
    validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    maxSeats: 10,
    features: ['Unlimited documents', 'AI-powered analysis', 'Real-time monitoring', 'API access', 'Priority support', 'Founding member badge'],
  },
  {
    id: 'founding-enterprise',
    name: 'Founding Enterprise',
    discountPercent: 40,
    validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    maxSeats: 50,
    features: ['Everything in Founding Pro', 'Custom integrations', 'Dedicated account manager', 'SLA guarantees', 'Advanced security', 'Early feature access'],
  },
]

const DISCOUNT_CODES: DiscountCode[] = [
  {
    code: 'FOUNDER30',
    type: 'percentage',
    value: 30,
    maxUses: 20,
    currentUses: 3,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    applicablePlans: ['pro-trial', 'founding-pro'],
  },
  {
    code: 'FOUNDER40',
    type: 'percentage',
    value: 40,
    maxUses: 10,
    currentUses: 1,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    applicablePlans: ['enterprise-trial', 'founding-enterprise'],
  },
  {
    code: 'LAUNCH20',
    type: 'fixed',
    value: 2000,
    maxUses: 50,
    currentUses: 12,
    expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    applicablePlans: ['pro-trial', 'founding-pro', 'enterprise-trial', 'founding-enterprise'],
  },
]

const activeTrials: Map<string, OrganizationTrial> = new Map()
const claimedPlans: Map<string, string> = new Map()

function calculateExpiry(durationDays: number): string {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
}

function calculateDaysRemaining(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)))
}

export function startTrial(orgId: string, planId: string): OrganizationTrial {
  const plan = TRIAL_PLANS.find(p => p.id === planId)
  if (!plan) throw new Error(`Trial plan "${planId}" not found`)
  const existing = activeTrials.get(orgId)
  if (existing && existing.status === 'active') throw new Error('Organization already has an active trial')
  const expiresAt = calculateExpiry(plan.durationDays)
  const trial: OrganizationTrial = {
    orgId,
    planId,
    startedAt: new Date().toISOString(),
    expiresAt,
    status: 'active',
    daysRemaining: plan.durationDays,
  }
  activeTrials.set(orgId, trial)
  return trial
}

export function getTrialStatus(orgId: string): OrganizationTrial | null {
  const trial = activeTrials.get(orgId)
  if (!trial) return null
  const daysRemaining = calculateDaysRemaining(trial.expiresAt)
  let status: OrganizationTrial['status'] = trial.status
  if (status === 'active' && daysRemaining === 0) {
    status = 'expired'
    trial.status = status
  }
  return { ...trial, daysRemaining, status }
}

export function extendTrial(orgId: string, extraDays: number): OrganizationTrial {
  const trial = activeTrials.get(orgId)
  if (!trial) throw new Error('No active trial found for this organization')
  const newExpiry = new Date(new Date(trial.expiresAt).getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString()
  const updated: OrganizationTrial = {
    ...trial,
    expiresAt: newExpiry,
    daysRemaining: calculateDaysRemaining(newExpiry),
    status: 'active',
  }
  activeTrials.set(orgId, updated)
  return updated
}

export function convertTrial(orgId: string): void {
  const trial = activeTrials.get(orgId)
  if (!trial) throw new Error('No active trial found for this organization')
  trial.status = 'converted'
  activeTrials.set(orgId, { ...trial })
}

export function getFoundingPlans(): FoundingPlan[] {
  return FOUNDING_PLANS.map(plan => ({
    ...plan,
    validUntil: plan.validUntil,
  }))
}

export function claimFoundingPlan(orgId: string, planId: string): void {
  const plan = FOUNDING_PLANS.find(p => p.id === planId)
  if (!plan) throw new Error(`Founding plan "${planId}" not found`)
  if (new Date(plan.validUntil) < new Date()) throw new Error('Founding plan has expired')
  if (claimedPlans.has(orgId)) throw new Error('Organization has already claimed a founding plan')
  claimedPlans.set(orgId, planId)
}

export async function validateDiscountCode(code: string, plan: string): Promise<{ valid: boolean; discount?: number; reason?: string }> {
  const result = await validateDiscount(code, plan)
  if (!result.valid) {
    return { valid: false, reason: result.error }
  }
  const codeEntry = DISCOUNT_CODES.find(d => d.code.toUpperCase() === code.toUpperCase())
  if (codeEntry) {
    if (!codeEntry.applicablePlans.includes(plan)) {
      return { valid: false, reason: 'Discount code not applicable for this plan' }
    }
  }
  if (result.discount) {
    const discountAmount = result.discount.type === 'percentage' ? result.discount.value : result.discount.value
    return { valid: true, discount: discountAmount }
  }
  return { valid: false, reason: 'Invalid discount code' }
}

export function applyDiscountCode(orgId: string, code: string): number {
  const codeEntry = DISCOUNT_CODES.find(d => d.code.toUpperCase() === code.toUpperCase())
  if (!codeEntry) throw new Error('Invalid discount code')
  if (codeEntry.currentUses >= codeEntry.maxUses) throw new Error('Discount code has reached max uses')
  if (new Date(codeEntry.expiresAt) < new Date()) throw new Error('Discount code has expired')
  const discountValue = codeEntry.type === 'percentage' ? codeEntry.value : codeEntry.value
  codeEntry.currentUses++
  return discountValue
}

export function listActiveTrials(): OrganizationTrial[] {
  return Array.from(activeTrials.values()).map(trial => ({
    ...trial,
    daysRemaining: calculateDaysRemaining(trial.expiresAt),
  }))
}

export function getTrialAnalytics(): { activeTrials: number; expiringSoon: number; conversionRate: number } {
  const all = Array.from(activeTrials.values())
  const active = all.filter(t => t.status === 'active')
  const expiringSoon = active.filter(t => calculateDaysRemaining(t.expiresAt) <= 3).length
  const converted = all.filter(t => t.status === 'converted').length
  const total = all.filter(t => t.status !== 'cancelled').length
  return {
    activeTrials: active.length,
    expiringSoon,
    conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
  }
}
