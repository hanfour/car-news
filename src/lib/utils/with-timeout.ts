/**
 * Wrap a promise with a timeout. Rejects with a TimeoutError if the promise
 * doesn't settle within `ms` milliseconds.
 *
 * The label appears in the error message to aid debugging when many timeouts
 * race (e.g. per-source in a scraper loop).
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[timeout] ${label} exceeded ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}
