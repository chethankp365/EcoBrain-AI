import { HTTPException } from 'hono/http-exception'

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return new HTTPException(status as never, {
    message,
    cause: { code, details },
  })
}

export function errorBody(err: unknown) {
  if (err instanceof HTTPException) {
    const cause = (err.cause ?? {}) as { code?: string; details?: unknown }
    return {
      error: {
        code: cause.code || `http_${err.status}`,
        message: err.message,
        details: cause.details,
      },
    }
  }
  return { error: { code: 'internal', message: 'Unexpected error' } }
}
