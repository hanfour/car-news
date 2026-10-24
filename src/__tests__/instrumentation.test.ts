/**
 * @jest-environment node
 */
import { register } from '../instrumentation'
import { logger } from '../lib/logger'

jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const mockLogger = logger as jest.Mocked<typeof logger>
const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.clearAllMocks()
})

describe('instrumentation register()', () => {
  it('does nothing outside the Node.js runtime (edge / build scan)', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    await register()
    expect(mockLogger.error).not.toHaveBeenCalled()
    expect(mockLogger.warn).not.toHaveBeenCalled()
    expect(mockLogger.info).not.toHaveBeenCalled()
  })

  it('logs an error listing hard-required env that is missing', async () => {
    process.env = { NEXT_RUNTIME: 'nodejs' } as unknown as NodeJS.ProcessEnv
    await register()
    expect(mockLogger.error).toHaveBeenCalledWith(
      'env.startup_check_required_missing',
      undefined,
      expect.objectContaining({
        missing: expect.arrayContaining(['SUPABASE_SERVICE_ROLE_KEY']),
      })
    )
  })

  it('warns on missing recommended env but no error when required is satisfied', async () => {
    process.env = {
      NEXT_RUNTIME: 'nodejs',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    } as unknown as NodeJS.ProcessEnv
    await register()
    expect(mockLogger.error).not.toHaveBeenCalled()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'env.startup_check_recommended_missing',
      expect.objectContaining({ missing: expect.any(Array) })
    )
  })
})
