export class ApiError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ApiError(error.message, 'INTERNAL_ERROR', 500);
  }
  
  if (typeof error === 'string') {
    return new ApiError(error, 'INTERNAL_ERROR', 500);
  }
  
  return new ApiError('An unknown error occurred', 'UNKNOWN_ERROR', 500);
}

export function createErrorResponse(error: unknown, defaultMessage: string = 'An error occurred'): Response {
  const apiError = handleApiError(error);
  return new Response(JSON.stringify({
    error: apiError.message,
    code: apiError.code,
    details: apiError.details
  }), {
    status: apiError.statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function createSuccessResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}