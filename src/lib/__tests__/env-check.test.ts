/**
 * @jest-environment node
 */
import { checkRequiredEnv } from '../env-check'

function fullEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    GEMINI_API_KEY: 'gemini-key',
    ANTHROPIC_API_KEY: 'anthropic-key',
    FAL_KEY: 'fal-key',
    CRON_SECRET: 'cron-secret',
    R2_ACCOUNT_ID: 'r2-account',
    R2_ACCESS_KEY_ID: 'r2-access',
    R2_SECRET_ACCESS_KEY: 'r2-secret',
    R2_BUCKET_NAME: 'r2-bucket',
    NEXT_PUBLIC_BASE_URL: 'https://example.com',
  }
}

describe('checkRequiredEnv', () => {
  it('reports nothing missing when every variable is set', () => {
    const { requiredMissing, recommendedMissing } = checkRequiredEnv(fullEnv())
    expect(requiredMissing).toEqual([])
    expect(recommendedMissing).toEqual([])
  })

  it('flags a missing hard-required Supabase key under requiredMissing', () => {
    const env = fullEnv()
    delete env.SUPABASE_SERVICE_ROLE_KEY
    const { requiredMissing, recommendedMissing } = checkRequiredEnv(env)
    expect(requiredMissing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(recommendedMissing).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('treats a blank/whitespace value as missing', () => {
    const env = fullEnv()
    env.NEXT_PUBLIC_SUPABASE_URL = '   '
    expect(checkRequiredEnv(env).requiredMissing).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('flags a missing recommended key (CRON_SECRET) without failing required', () => {
    const env = fullEnv()
    delete env.CRON_SECRET
    const { requiredMissing, recommendedMissing } = checkRequiredEnv(env)
    expect(requiredMissing).toEqual([])
    expect(recommendedMissing).toContain('CRON_SECRET')
  })

  it('accepts GOOGLE_AI_API_KEY as an alternative to GEMINI_API_KEY', () => {
    const env = fullEnv()
    delete env.GEMINI_API_KEY
    env.GOOGLE_AI_API_KEY = 'google-key'
    expect(checkRequiredEnv(env).recommendedMissing).not.toContain(
      'GEMINI_API_KEY|GOOGLE_AI_API_KEY'
    )
  })

  it('flags the Gemini group as missing only when BOTH alternatives are absent', () => {
    const env = fullEnv()
    delete env.GEMINI_API_KEY
    expect(checkRequiredEnv(env).recommendedMissing).toContain('GEMINI_API_KEY|GOOGLE_AI_API_KEY')
  })
})
