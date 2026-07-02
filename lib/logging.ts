import 'server-only'

// Simple server-side logging utility

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] ${message}`, metadata)
  }
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  console.warn(`[WARN] ${message}`, metadata)
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  console.error(`[ERROR] ${message}`, metadata)
}

export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DEBUG] ${message}`, metadata)
  }
}

// Error logging with stack trace
export function logException(error: Error, context?: Record<string, unknown>): void {
  console.error(`[EXCEPTION] ${error.message}`, {
    stack: error.stack,
    ...context,
  })
}