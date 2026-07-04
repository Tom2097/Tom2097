import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { withValidation, type ValidationResult } from './validate-request'
import type { ZodSchema } from 'zod'

// Type definitions for rate limit configurations
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number
  /** Time window in seconds */
  windowMs: number
  /** Key identifier (ip, userId, or custom) */
  key: string
  /** Custom identifier function */
  identifier?: (request: NextRequest) => string
  /** Response message when rate limited */
  message?: string
  /** HTTP status code when rate limited */
  statusCode?: number
  /** Headers to include in response */
  includeHeaders?: boolean
}

// Default rate limit configurations
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Global API rate limit: 100 requests per minute
  global: {
    maxRequests: 100,
    windowMs: 60,
    key: 'global',
    message: 'Too many requests. Please try again later.',
    statusCode: 429,
    includeHeaders: true,
  },
  // Auth endpoints: 10 requests per minute (brute force protection)
  auth: {
    maxRequests: 10,
    windowMs: 60,
    key: 'auth',
    message: 'Too many authentication attempts. Please wait before trying again.',
    statusCode: 429,
    includeHeaders: true,
  },
  // API endpoints: 60 requests per minute
  api: {
    maxRequests: 60,
    windowMs: 60,
    key: 'api',
    message: 'API rate limit exceeded. Please try again later.',
    statusCode: 429,
    includeHeaders: true,
  },
  // File uploads: 5 requests per minute
  upload: {
    maxRequests: 5,
    windowMs: 60,
    key: 'upload',
    message: 'Too many upload requests. Please try again later.',
    statusCode: 429,
    includeHeaders: true,
  },
}

// Redis client for Upstash
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

/**
 * Create a rate limiter instance
 */
export function createRateLimiter(config: RateLimitConfig): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs} ms`),
    analytics: true,
    redis: getRedis(),
    limiter: config.key,
    max: config.maxRequests,
    window: `${config.windowMs}s`,
  })
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  // Vercel adds x-forwarded-for and x-real-ip headers
  if (xForwardedFor) {
    // Take the first IP in the chain (original client)
    return xForwardedFor.split(',')[0].trim()
  }
  
  if (xRealIP) {
    return xRealIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return 'unknown'
}

/**
 * Get user identifier from request (user ID or IP address)
 */
export function getRequestIdentifier(
  request: NextRequest,
  type: 'ip' | 'user' | 'custom'
): string {
  switch (type) {
    case 'ip':
      return getClientIP(request)
    case 'user': {
      // Try to get user ID from JWT or session
      const authorization = request.headers.get('authorization')
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.substring(7)
        // Simple decode to get user ID (no verification for rate limiting)
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
          return `user:${payload.sub || payload.userId || 'unknown'}`
        } catch {
          return `ip:${getClientIP(request)}`
        }
      }
      return `ip:${getClientIP(request)}`
    }
    case 'custom':
    default:
      return getClientIP(request)
  }
}

/**
 * Rate limit middleware for Next.js route handlers
 * 
 * @example
 * ```ts
 * import { withRateLimit } from '@/lib/middleware/rate-limit'
 * import { DEFAULT_RATE_LIMITS } from '@/lib/middleware/rate-limit'
 * 
 * export const GET = withRateLimit(
 *   async (request) => {
 *     return NextResponse.json({ data: 'protected' })
 *   },
 *   DEFAULT_RATE_LIMITS.api
 * )
 * ```
 */
export function withRateLimit<C = { params: Record<string, string> }>(
  handler: (request: NextRequest, context?: C) => Promise<NextResponse>,
  config: RateLimitConfig = DEFAULT_RATE_LIMITS.global
) {
  return async (request: NextRequest, context?: C): Promise<NextResponse> => {
    try {
      const limiter = createRateLimiter(config)
      
      const identifier = config.identifier
        ? config.identifier(request)
        : getRequestIdentifier(request, 'user')
      
      const { success, limit, remaining, reset } = await limiter.limit(identifier)
      
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        
        const response = NextResponse.json(
          {
            error: config.message || 'Too many requests',
            retryAfter,
            limit,
            remaining: 0,
          },
          { status: config.statusCode || 429 }
        )
        
        if (config.includeHeaders !== false) {
          response.headers.set('X-RateLimit-Limit', limit.toString())
          response.headers.set('X-RateLimit-Remaining', '0')
          response.headers.set('X-RateLimit-Reset', Math.ceil(reset / 1000).toString())
          response.headers.set('Retry-After', retryAfter.toString())
        }
        
        return response
      }
      
      const response = await handler(request, context)
      
      if (config.includeHeaders !== false) {
        response.headers.set('X-RateLimit-Limit', limit.toString())
        response.headers.set('X-RateLimit-Remaining', remaining.toString())
        response.headers.set('X-RateLimit-Reset', Math.ceil(reset / 1000).toString())
      }
      
      return response
    } catch (error) {
      console.error('[RateLimit] Error:', error)
      return handler(request, context)
    }
  }
}

/**
 * Combined middleware: Validation + Rate Limiting
 * 
 * @example
 * ```ts
 * import { withValidation, withRateLimit } from '@/lib/middleware'
 * import { z } from 'zod'
 * 
 * const schema = z.object({ name: z.string() })
 * 
 * export const POST = withRateLimit(
 *   withValidation(
 *     async (request, ctx) => {
 *       return NextResponse.json({ success: true })
 *     },
 *     { body: schema }
 *   ),
 *   DEFAULT_RATE_LIMITS.api
 * )
 * ```
 */
export function withMiddleware(
  handler: (request: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse>,
  options: {
    rateLimit?: RateLimitConfig
    body?: ZodSchema<Record<string, unknown>>
    query?: ZodSchema<Record<string, unknown>>
    params?: ZodSchema<Record<string, unknown>>
  } = {}
) {
  let wrapped = handler
  
  // Apply rate limiting first
  if (options.rateLimit) {
    wrapped = withRateLimit(wrapped, options.rateLimit)
  }
  
  // Apply validation
  if (options.body || options.query || options.params) {
    wrapped = withValidation(wrapped, {
      body: options.body,
      query: options.query,
      params: options.params,
    })
  }
  
  return wrapped
}

/**
 * Create a rate limited API route with validation
 */
export function createProtectedRoute(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  handler: (request: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse>,
  options: {
    rateLimit?: RateLimitConfig
    body?: ZodSchema<Record<string, unknown>>
    query?: ZodSchema<Record<string, unknown>>
    params?: ZodSchema<Record<string, unknown>>
  } = {}
) {
  const wrapped = withMiddleware(handler, options)
  
  // Type assertion for route method
  const routeHandler = wrapped as (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ) => Promise<NextResponse>
  
  return { [method]: routeHandler }
}

// Export types
export type { Ratelimit }
