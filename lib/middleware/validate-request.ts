import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ZodSchema, ZodError } from 'zod'

/**
 * Validation result type for request data
 */
export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    details?: { path: string[]; message: string }[]
  }
}

/**
 * Validates request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    return {
      success: false,
      error: {
        message: 'Invalid request body',
        details: result.error.errors.map((err) => ({
          path: err.path,
          message: err.message,
        })),
      },
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          message: 'Invalid JSON in request body',
        },
      }
    }
    throw error
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert numeric strings to numbers
    const processedParams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(queryParams)) {
      if (!isNaN(Number(value)) && value.trim() !== '') {
        processedParams[key] = Number(value)
      } else if (value === 'true') {
        processedParams[key] = true
      } else if (value === 'false') {
        processedParams[key] = false
      } else {
        processedParams[key] = value
      }
    }
    
    const result = schema.safeParse(processedParams)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    return {
      success: false,
      error: {
        message: 'Invalid query parameters',
        details: result.error.errors.map((err) => ({
          path: err.path,
          message: err.message,
        })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Failed to parse query parameters',
      },
    }
  }
}

/**
 * Validates path parameters against a Zod schema
 */
export function validateParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    // Convert param arrays to single values (Next.js route params)
    const processedParams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        processedParams[key] = value[0]
      } else {
        processedParams[key] = value
      }
    }
    
    const result = schema.safeParse(processedParams)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    return {
      success: false,
      error: {
        message: 'Invalid path parameters',
        details: result.error.errors.map((err) => ({
          path: err.path,
          message: err.message,
        })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Failed to parse path parameters',
      },
    }
  }
}

/**
 * Creates a validation middleware for Next.js route handlers
 * 
 * @example
 * ```ts
 * import { withValidation } from '@/lib/middleware/validate-request'
 * import { z } from 'zod'
 * 
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * })
 * 
 * export const POST = withValidation(
 *   async (request, context) => {
 *     // context.validatedBody is already validated
 *     return NextResponse.json({ success: true })
 *   },
 *   { body: schema }
 * )
 * ```
 */
export function withValidation<T extends NextRequest, U extends Record<string, unknown>>(
  handler: (
    request: T,
    context: { params: Record<string, string> } & {
      validatedBody?: U
      validatedQuery?: Record<string, unknown>
      validatedParams?: Record<string, unknown>
    }
  ) => Promise<NextResponse>,
  options: {
    body?: ZodSchema<U>
    query?: ZodSchema<unknown>
    params?: ZodSchema<unknown>
  } = {}
) {
  return async (request: T, context: { params: Record<string, string> }) => {
    // Validate body if schema provided
    let validatedBody: U | undefined
    if (options.body) {
      const bodyResult = await validateBody<U>(request, options.body)
      if (!bodyResult.success) {
        return NextResponse.json(
          {
            error: bodyResult.error?.message,
            details: bodyResult.error?.details,
          },
          { status: 400 }
        )
      }
      validatedBody = bodyResult.data
    }

    // Validate query if schema provided
    let validatedQuery: Record<string, unknown> | undefined
    if (options.query) {
      const queryResult = validateQuery(request, options.query)
      if (!queryResult.success) {
        return NextResponse.json(
          {
            error: queryResult.error?.message,
            details: queryResult.error?.details,
          },
          { status: 400 }
        )
      }
      validatedQuery = queryResult.data
    }

    // Validate params if schema provided
    let validatedParams: Record<string, unknown> | undefined
    if (options.params) {
      const paramsResult = validateParams(context.params, options.params)
      if (!paramsResult.success) {
        return NextResponse.json(
          {
            error: paramsResult.error?.message,
            details: paramsResult.error?.details,
          },
          { status: 400 }
        )
      }
      validatedParams = paramsResult.data
    }

    return handler(request, {
      ...context,
      validatedBody,
      validatedQuery,
      validatedParams,
    })
  }
}

/**
 * Standard error responses for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: { path: string[]; message: string }[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function createValidationErrorResponse(
  error: ZodError<unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: error.errors.map((err) => ({
        path: err.path,
        message: err.message,
        code: err.code,
      })),
    },
    { status: 400 }
  )
}
