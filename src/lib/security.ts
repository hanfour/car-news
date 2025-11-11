/**
 * Security utilities for the application
 */

/**
 * Validates if a URL is safe to use for images
 * Prevents XSS attacks via javascript: and data: URIs
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    // Invalid URL format
    return false
  }
}

/**
 * Returns a safe image URL or a fallback
 * This should be used before rendering user-provided image URLs
 */
export function getSafeImageUrl(url: string | null | undefined, fallback: string = ''): string {
  return isValidImageUrl(url) ? url! : fallback
}

/**
 * Validates if a redirect URL is safe
 * Prevents open redirect vulnerabilities
 */
export function getSafeRedirectUrl(origin: string | undefined): string {
  // Use environment variable or default to production URL
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:3000',
    'http://localhost:3006',
  ].filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    return origin
  }

  // Fallback to environment variable or localhost
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}
