interface RevenueMetrics {
  mrr: number
  arr: number
  previousMrr: number
  mrrChange: number
  arrChange: number
  activeSubscriptions: number
  churnRate: number
  previousChurnRate: number
  churnChange: number
  averageRevenuePerUser: number
  lifetimeValue: number
  revenueByPlan: { planName: string; amount: number; subscribers: number }[]
  revenueByRegion: { region: string; amount: number; percentage: number }[]
  monthlyTrend: { month: string; mrr: number; churn: number; newBusiness: number }[]
}

interface ChurnAnalysis {
  totalChurned: number
  voluntaryChurn: number
  involuntaryChurn: number
  churnByReason: { reason: string; count: number }[]
  churnByPlan: { planName: string; count: number }[]
  atRiskAccounts: { name: string; email: string; plan: string; risk: 'low' | 'medium' | 'high' }[]
}

interface RevenueForecast {
  currentMrr: number
  forecastNextMonth: number
  forecastNextQuarter: number
  forecastNextYear: number
  confidence: 'low' | 'medium' | 'high'
  growthRate: number
}

function generateMonthlyTrend(months: number): { month: string; mrr: number; churn: number; newBusiness: number }[] {
  const now = new Date()
  const trend: { month: string; mrr: number; churn: number; newBusiness: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const baseMrr = 1250000 + (months - i) * 85000 + Math.floor(Math.random() * 50000)
    trend.push({
      month,
      mrr: baseMrr,
      churn: Number((2.5 + Math.random() * 1.5).toFixed(1)),
      newBusiness: Math.floor(8 + Math.random() * 6),
    })
  }
  return trend
}

export function getRevenueMetrics(): RevenueMetrics {
  const currentMrr = 1850000
  const previousMrr = 1620000
  const mrrChange = Number((((currentMrr - previousMrr) / previousMrr) * 100).toFixed(1))
  const arr = currentMrr * 12
  const previousArr = previousMrr * 12
  const arrChange = Number((((arr - previousArr) / previousArr) * 100).toFixed(1))
  const churnRate = 2.8
  const previousChurnRate = 3.5
  const churnChange = Number(((previousChurnRate - churnRate) / previousChurnRate * 100).toFixed(1))
  const activeSubscriptions = 342
  const averageRevenuePerUser = Math.round(currentMrr / activeSubscriptions)
  const lifetimeValue = Math.round(averageRevenuePerUser * (1 / (churnRate / 100)))

  return {
    mrr: currentMrr,
    arr,
    previousMrr,
    mrrChange,
    arrChange,
    activeSubscriptions,
    churnRate,
    previousChurnRate,
    churnChange,
    averageRevenuePerUser,
    lifetimeValue,
    revenueByPlan: [
      { planName: 'Starter', amount: 280000, subscribers: 140 },
      { planName: 'Professional', amount: 720000, subscribers: 120 },
      { planName: 'Enterprise', amount: 850000, subscribers: 82 },
    ],
    revenueByRegion: [
      { region: 'North India', amount: 740000, percentage: 40 },
      { region: 'South India', amount: 555000, percentage: 30 },
      { region: 'West India', amount: 370000, percentage: 20 },
      { region: 'East India', amount: 185000, percentage: 10 },
    ],
    monthlyTrend: generateMonthlyTrend(6),
  }
}

export function getChurnAnalysis(): ChurnAnalysis {
  return {
    totalChurned: 28,
    voluntaryChurn: 19,
    involuntaryChurn: 9,
    churnByReason: [
      { reason: 'High pricing', count: 8 },
      { reason: 'Missing features', count: 6 },
      { reason: 'Poor integration', count: 5 },
      { reason: 'Payment failure', count: 4 },
      { reason: 'Switched to competitor', count: 3 },
      { reason: 'Business closed', count: 2 },
    ],
    churnByPlan: [
      { planName: 'Starter', count: 15 },
      { planName: 'Professional', count: 9 },
      { planName: 'Enterprise', count: 4 },
    ],
    atRiskAccounts: [
      { name: 'TechSolve India', email: 'admin@techsolve.in', plan: 'Starter', risk: 'high' },
      { name: 'GreenField Analytics', email: 'contact@greenfield.in', plan: 'Professional', risk: 'high' },
      { name: 'Pinnacle Corp', email: 'it@pinnacle.in', plan: 'Enterprise', risk: 'medium' },
      { name: 'Sapphire Solutions', email: 'ops@sapphire.in', plan: 'Starter', risk: 'medium' },
      { name: 'Velox Logistics', email: 'support@velox.in', plan: 'Professional', risk: 'low' },
    ],
  }
}

export function getRevenueForecast(): RevenueForecast {
  const currentMrr = 1850000
  const growthRate = 8.5
  return {
    currentMrr,
    forecastNextMonth: Math.round(currentMrr * (1 + growthRate / 100 / 12)),
    forecastNextQuarter: Math.round(currentMrr * (1 + growthRate / 100 / 4)),
    forecastNextYear: Math.round(currentMrr * (1 + growthRate / 100)),
    confidence: 'medium',
    growthRate,
  }
}

export function getMonthlyMrrHistory(months: number = 12): { month: string; mrr: number }[] {
  return generateMonthlyTrend(months).map(({ month, mrr }) => ({ month, mrr }))
}
