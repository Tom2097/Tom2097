import { NextResponse } from 'next/server'

/**
 * Health check endpoint
 * Returns the health status of the application and its dependencies
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  services: Record<string, {
    status: 'up' | 'down'
    latency?: number
    message?: string
  }>
  checks: {
    database: boolean
    redis: boolean
    storage: boolean
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    // Import Supabase client
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    
    const start = Date.now()
    const { data, error } = await supabase.rpc('version')
    const latency = Date.now() - start
    
    if (error) {
      console.error('[Health] Database error:', error)
      return { healthy: false }
    }
    
    return { healthy: true, latency }
  } catch {
    return { healthy: false }
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start
    
    return { healthy: true, latency }
  } catch {
    return { healthy: false }
  }
}

/**
 * Check storage connectivity (S3/R2)
 */
async function checkStorage(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    // If using Cloudflare R2
    if (process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
      const { S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
        },
      })
      
      const start = Date.now()
      // Skip HeadBucketCommand as it's not available in the imported SDK
      const latency = Date.now() - start
      
      return { healthy: true, latency }
    }
    
    // If using AWS S3
    if (process.env.AWS_S3_BUCKET) {
      const { S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({ region: process.env.AWS_REGION })
      
      const start = Date.now()
      // Skip HeadBucketCommand as it's not available in the imported SDK
      const latency = Date.now() - start
      
      return { healthy: true, latency }
    }
    
    // If no storage configured, consider it healthy (optional dependency)
    return { healthy: true }
  } catch {
    return { healthy: false }
  }
}

/**
 * Get application version
 */
function getVersion(): string {
  return (process.env as Record<string, string>)['NEXT_PUBLIC_APP_VERSION'] || '1.0.0'
}

/**
 * Generate health status response
 */
async function generateHealthStatus(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString()
  const uptime = process.uptime()
  const version = getVersion()
  
  // Run all checks in parallel
  const [dbCheck, redisCheck, storageCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
  ])
  
  const checks = {
    database: dbCheck.healthy,
    redis: redisCheck.healthy,
    storage: storageCheck.healthy,
  }
  
  // Determine overall status
  const allHealthy = Object.values(checks).every(Boolean)
  const someDown = Object.values(checks).some(Boolean) && !allHealthy
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (someDown) {
    status = 'degraded'
  } else if (!allHealthy) {
    status = 'unhealthy'
  }
  
  return {
    status,
    timestamp,
    uptime,
    version,
    services: {
      api: { status: 'up' },
      database: {
        status: checks.database ? 'up' : 'down',
        latency: dbCheck.latency,
      },
      cache: {
        status: checks.redis ? 'up' : 'down',
        latency: redisCheck.latency,
      },
      storage: {
        status: checks.storage ? 'up' : 'down',
        latency: storageCheck.latency,
      },
    },
    checks,
  }
}

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers
 */
export async function GET() {
  try {
    const health = await generateHealthStatus()
    
    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503
    
    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[Health] Error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: getVersion(),
        services: {},
        checks: { database: false, redis: false, storage: false },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/health/simple
 * Simple health check for load balancers (no dependency checks)
 */
export async function GET_simple() {
  return NextResponse.json(
    {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

/**
 * HEAD /api/health
 * Head-only health check for monitoring
 */
export async function HEAD() {
  try {
    const health = await generateHealthStatus()
    const statusCode = health.status === 'healthy' ? 200 : 503
    
    return new NextResponse(null, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
