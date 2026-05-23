// DigiT Enterprise Platform - Mock Data Generators

import type { 
  Module, 
  MetricData, 
  ChartDataPoint, 
  TimeSeriesData,
  DashboardStats 
} from './types'

export const modules: Module[] = [
  {
    id: 'analytics',
    title: 'AI Analytics',
    icon: 'BarChart3',
    description: 'Enterprise intelligence and predictive analytics with AI-powered insights.',
    metrics: ['Revenue Forecasting', 'Risk Analysis', 'Operational Insights', 'Trend Detection'],
    href: '/analytics',
    color: 'chart-1'
  },
  {
    id: 'crm',
    title: 'Smart CRM',
    icon: 'Users',
    description: 'AI-driven customer management, engagement tracking, and sales automation.',
    metrics: ['Lead Tracking', 'Client Intelligence', 'AI Automation', 'Pipeline Management'],
    href: '/crm',
    color: 'chart-2'
  },
  {
    id: 'healthcare',
    title: 'Healthcare AI',
    icon: 'Heart',
    description: 'AI systems for hospitals, clinics, and healthcare operations management.',
    metrics: ['Patient Data', 'Resource Planning', 'AI Diagnostics', 'Care Optimization'],
    href: '/healthcare',
    color: 'chart-3'
  },
  {
    id: 'banking',
    title: 'Banking Intelligence',
    icon: 'Building2',
    description: 'Financial intelligence, fraud detection, and market analysis systems.',
    metrics: ['Fraud Detection', 'Credit Scoring', 'Market Signals', 'Risk Assessment'],
    href: '/banking',
    color: 'chart-4'
  },
  {
    id: 'agro',
    title: 'Agro-Tech Systems',
    icon: 'Wheat',
    description: 'AI systems for agriculture, supply chain optimization, and climate analysis.',
    metrics: ['Yield Forecasting', 'Climate Analysis', 'Smart Logistics', 'Crop Intelligence'],
    href: '/agro',
    color: 'chart-5'
  },
  {
    id: 'pharma',
    title: 'Pharma Intelligence',
    icon: 'Pill',
    description: 'Pharmaceutical enterprise operations, compliance, and drug analytics.',
    metrics: ['Drug Analytics', 'Production Monitoring', 'Compliance AI', 'Trial Management'],
    href: '/pharma',
    color: 'chart-1'
  }
]

export const dashboardStats: DashboardStats = {
  aiAccuracy: 98.7,
  enterpriseClients: 240,
  dataStreams: 12000000,
  uptime: 99.9,
  responseTime: 12,
  activeOperations: 184
}

export const liveMetrics: MetricData[] = [
  { label: 'AI Accuracy', value: '98.7%', trend: 'up', change: 2.3 },
  { label: 'Enterprise Clients', value: '240+', trend: 'up', change: 15 },
  { label: 'Data Streams', value: '12M+', trend: 'stable', change: 0 },
  { label: 'Operational Monitoring', value: '24/7', trend: 'stable' }
]

export const activeOperations = [
  'Customer Intelligence',
  'Workflow Automation',
  'Fraud Monitoring',
  'Predictive Decision Systems',
  'Data Synchronization',
  'AI Decision Engine'
]

// Generate realistic time series data
export function generateTimeSeriesData(
  days: number = 30,
  baseValue: number = 100,
  variance: number = 20
): TimeSeriesData[] {
  const data: TimeSeriesData[] = []
  const now = new Date()
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // Add some realistic variance with a slight upward trend
    const trendFactor = 1 + (days - i) * 0.005
    const randomVariance = (Math.random() - 0.5) * variance
    const value = Math.round((baseValue * trendFactor + randomVariance) * 100) / 100
    
    data.push({
      timestamp: date.toISOString().split('T')[0],
      value: Math.max(0, value)
    })
  }
  
  return data
}

// Generate revenue forecast data
export function generateRevenueForecast(): ChartDataPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonth = new Date().getMonth()
  
  return months.map((month, index) => {
    const baseRevenue = 850000 + Math.random() * 200000
    const isForecast = index > currentMonth
    
    return {
      name: month,
      value: Math.round(baseRevenue),
      actual: index <= currentMonth ? Math.round(baseRevenue) : 0,
      forecast: isForecast ? Math.round(baseRevenue * (1 + Math.random() * 0.1)) : 0,
      type: isForecast ? 'forecast' : 'actual'
    }
  })
}

// Generate risk analysis data
export function generateRiskData(): ChartDataPoint[] {
  const categories = ['Market', 'Operational', 'Financial', 'Compliance', 'Cyber', 'Strategic']
  
  return categories.map(category => ({
    name: category,
    value: Math.round(20 + Math.random() * 60),
    threshold: 70,
    status: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
  }))
}

// Generate operational metrics
export function generateOperationalMetrics(): ChartDataPoint[] {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
  
  return hours.map(hour => ({
    name: hour,
    value: Math.round(60 + Math.random() * 35),
    cpu: Math.round(40 + Math.random() * 40),
    memory: Math.round(50 + Math.random() * 30),
    network: Math.round(20 + Math.random() * 60)
  }))
}

// Generate pipeline data for CRM
export function generatePipelineData(): ChartDataPoint[] {
  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won']
  const baseValues = [1200, 850, 420, 280, 180]
  
  return stages.map((stage, index) => ({
    name: stage,
    value: baseValues[index] + Math.round(Math.random() * 100),
    conversion: Math.round(70 + Math.random() * 25)
  }))
}

// Generate real-time update simulation
export function simulateRealtimeUpdate(currentValue: number, maxChange: number = 5): number {
  const change = (Math.random() - 0.5) * maxChange * 2
  return Math.max(0, Math.round((currentValue + change) * 100) / 100)
}

// API Client Mock (ready for real integration)
export class MockAPIClient {
  private baseUrl: string
  
  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
  }
  
  async fetchAnalytics(): Promise<{ revenue: ChartDataPoint[], risk: ChartDataPoint[] }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      revenue: generateRevenueForecast(),
      risk: generateRiskData()
    }
  }
  
  async fetchMetrics(): Promise<MetricData[]> {
    await new Promise(resolve => setTimeout(resolve, 50))
    return liveMetrics.map(metric => ({
      ...metric,
      value: typeof metric.value === 'string' && metric.value.includes('%')
        ? `${simulateRealtimeUpdate(parseFloat(metric.value))}%`
        : metric.value
    }))
  }
  
  async fetchOperations(): Promise<ChartDataPoint[]> {
    await new Promise(resolve => setTimeout(resolve, 75))
    return generateOperationalMetrics()
  }
}
