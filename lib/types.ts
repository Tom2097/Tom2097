// DigiT Enterprise Platform - Type Definitions

export interface Module {
  id: string
  title: string
  icon: string
  description: string
  metrics: string[]
  href: string
  color: string
}

export interface MetricData {
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'stable'
  unit?: string
}

export interface ChartDataPoint {
  name: string
  value: number
  [key: string]: string | number
}

export interface TimeSeriesData {
  timestamp: string
  value: number
  category?: string
}

export interface PredictionResult {
  prediction: string
  confidence: number
  factors: string[]
  recommendation: string
}

export interface APIClientConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
  headers?: Record<string, string>
}

export interface APIResponse<T> {
  data: T
  status: 'success' | 'error'
  message?: string
  timestamp: string
}

export interface EnterpriseDataSource {
  id: string
  name: string
  type: 'rest' | 'graphql' | 'websocket' | 'webhook'
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'trigger' | 'action' | 'condition'
  config: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  isActive: boolean
  lastRun?: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface DashboardStats {
  aiAccuracy: number
  enterpriseClients: number
  dataStreams: number
  uptime: number
  responseTime: number
  activeOperations: number
}

// Module-specific types
export interface AnalyticsData {
  revenue: TimeSeriesData[]
  forecast: TimeSeriesData[]
  riskScore: number
  insights: string[]
}

export interface CRMData {
  leads: number
  conversion: number
  customerSatisfaction: number
  pipeline: ChartDataPoint[]
}

export interface HealthcareData {
  patients: number
  bedOccupancy: number
  avgWaitTime: number
  resourceUtilization: ChartDataPoint[]
}

export interface BankingData {
  fraudAlerts: number
  transactionVolume: number
  creditRiskScore: number
  marketSignals: ChartDataPoint[]
}

export interface AgroData {
  yieldForecast: number
  climateRisk: string
  supplyChainStatus: string
  cropHealth: ChartDataPoint[]
}

export interface PharmaData {
  drugTrials: number
  productionEfficiency: number
  complianceScore: number
  inventoryLevels: ChartDataPoint[]
}

// Multi-Tenant Types (Module #1)
export interface TenantContext {
  tenantId: string
  organizationId: string
  userId: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  permissions: string[]
  organizationSlug: string
  organizationName: string
}

export interface TenantRequest {
  tenantId: string
  organizationId: string
  userId: string
  validatedAt: number
}

export interface TenantRateLimitConfig {
  hourlyLimit: number
  minuteLimit: number
  keyPrefix: string
}

export interface TenantRegistrationData {
  organizationName: string
  email: string
  password: string
  fullName: string
  companyName?: string
  industry?: string
  role?: string
}

export interface TenantOnboardingResponse {
  tenantId: string
  organizationId: string
  userId: string
  jwtToken: string
  organization: {
    id: string
    name: string
    slug: string
    createdAt: string
  }
}
