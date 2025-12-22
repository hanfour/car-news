/**
 * Type-safe error handling utilities
 * Eliminates the need for `catch (error: any)` patterns
 */

/**
 * Extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'An unknown error occurred'
}

/**
 * Extracts error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack
  }
  return undefined
}

/**
 * Type guard to check if error has a specific property
 */
export function hasErrorProperty<K extends string>(
  error: unknown,
  prop: K
): error is { [P in K]: unknown } {
  return error !== null && typeof error === 'object' && prop in error
}

/**
 * Logs error with proper type handling
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error)
  const stack = getErrorStack(error)

  if (stack) {
    console.error(`[${context}] ${message}`, stack)
  } else {
    console.error(`[${context}] ${message}`)
  }
}
