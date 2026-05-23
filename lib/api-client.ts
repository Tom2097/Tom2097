// DigiT Enterprise Platform - API Client for External Integrations

import type { APIClientConfig, APIResponse, EnterpriseDataSource } from './types'

/**
 * Enterprise API Client
 * Ready for integration with external enterprise systems
 * Supports REST, GraphQL, WebSocket, and Webhook patterns
 */
export class EnterpriseAPIClient {
  private config: APIClientConfig
  private dataSources: Map<string, EnterpriseDataSource> = new Map()

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    }
  }

  /**
   * Register an external data source
   */
  registerDataSource(source: EnterpriseDataSource): void {
    this.dataSources.set(source.id, source)
  }

  /**
   * Get all registered data sources
   */
  getDataSources(): EnterpriseDataSource[] {
    return Array.from(this.dataSources.values())
  }

  /**
   * Make a GET request to an external API
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<APIResponse<T>> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        data,
        status: 'success',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        data: null as T,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Make a POST request to an external API
   */
  async post<T>(endpoint: string, body: unknown): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        data,
        status: 'success',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        data: null as T,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Create a WebSocket connection for real-time data
   */
  createWebSocketConnection(
    endpoint: string,
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void
  ): WebSocket | null {
    if (typeof window === 'undefined') return null

    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws') + endpoint
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch {
        onMessage(event.data)
      }
    }

    ws.onerror = (error) => {
      if (onError) onError(error)
    }

    return ws
  }

  /**
   * Execute a GraphQL query
   */
  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<APIResponse<T>> {
    return this.post<T>('/graphql', { query, variables })
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...this.config.headers
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    return headers
  }
}

/**
 * Create a pre-configured API client instance
 * Configure with your enterprise API endpoints
 */
export function createAPIClient(config?: Partial<APIClientConfig>): EnterpriseAPIClient {
  return new EnterpriseAPIClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
    apiKey: process.env.API_KEY,
    ...config
  })
}

/**
 * Webhook handler for receiving external events
 */
export interface WebhookPayload {
  event: string
  source: string
  data: unknown
  timestamp: string
  signature?: string
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Implement HMAC signature validation for production
  // This is a placeholder for the actual implementation
  if (!signature || !secret) return false
  
  // In production, use crypto.subtle or a library like crypto
  // to validate HMAC-SHA256 signatures
  return true
}
