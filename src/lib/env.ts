/**
 * Environment variable validation
 * Priority: P1 - Prevents silent failures
 *
 * This file validates all required environment variables at application startup.
 * Throws errors immediately rather than failing at runtime.
 */

interface RequiredEnvVars {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // AI APIs
  ANTHROPIC_API_KEY: string
  OPENAI_API_KEY: string

  // Admin Security
  ADMIN_API_KEY: string
  CRON_SECRET: string

  // App Config
  NEXT_PUBLIC_BASE_URL: string
}

const INSECURE_DEFAULTS = [
  'admin-secret-key-change-me',
  'your-secret-key-here',
  'change-me',
  'test',
  'password',
]

function validateEnvVar(name: keyof RequiredEnvVars, value: string | undefined): string {
  // Check if variable exists
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Environment variable ${name} is not set.\n` +
      `Please add it to your .env.local file.\n` +
      `See .env.example for reference.`
    )
  }

  // Check for insecure defaults (security-critical variables only)
  if (name.includes('API_KEY') || name.includes('SECRET')) {
    const lowerValue = value.toLowerCase()
    for (const insecure of INSECURE_DEFAULTS) {
      if (lowerValue.includes(insecure)) {
        throw new Error(
          `❌ Environment variable ${name} contains insecure default value: "${insecure}".\n` +
          `Please set a secure random value.`
        )
      }
    }

    // Check minimum length for secrets
    if (value.length < 20) {
      throw new Error(
        `❌ Environment variable ${name} is too short (${value.length} characters).\n` +
        `Security keys should be at least 20 characters long.`
      )
    }
  }

  return value
}

/**
 * Validate all required environment variables
 * Call this at application startup
 */
export function validateEnv(): RequiredEnvVars {
  try {
    const env: RequiredEnvVars = {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: validateEnvVar('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: validateEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: validateEnvVar('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),

      // AI APIs
      ANTHROPIC_API_KEY: validateEnvVar('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: validateEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY),

      // Admin Security
      ADMIN_API_KEY: validateEnvVar('ADMIN_API_KEY', process.env.ADMIN_API_KEY),
      CRON_SECRET: validateEnvVar('CRON_SECRET', process.env.CRON_SECRET),

      // App Config
      NEXT_PUBLIC_BASE_URL: validateEnvVar('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_BASE_URL),
    }

    console.log('✅ All environment variables validated successfully')
    return env
  } catch (error) {
    console.error('\n🚨 Environment Variable Validation Failed:\n')
    console.error((error as Error).message)
    console.error('\nApplication cannot start. Please fix the above issues.\n')
    process.exit(1)
  }
}

// Export validated environment
export const env = validateEnv()
