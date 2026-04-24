/**
 * 結構化 logger — JSON 格式輸出，方便 Vercel Log Drains / Sentry 收集。
 *
 * 用法：
 *   import { logger } from '@/lib/logger'
 *   logger.info('article.generated', { articleId, brand })
 *   logger.error('ai.claude.fail', err, { retryCount })
 *
 * 相較於散落的 console.log，好處：
 * - 統一 shape，可透過結構化 log 查詢
 * - 可在此處集中加上 Sentry / 其他 APM
 * - 測試環境可被 mock / silence
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  if (isTest) return // 測試環境預設靜音，需要時在測試中 spy

  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...context,
  }

  const line = JSON.stringify(entry, (_, value) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: isProd ? undefined : value.stack,
      }
    }
    return value
  })

  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export const logger = {
  debug: (event: string, context?: LogContext) => {
    if (!isProd) emit('debug', event, context)
  },
  info: (event: string, context?: LogContext) => emit('info', event, context),
  warn: (event: string, context?: LogContext) => emit('warn', event, context),
  error: (event: string, error?: unknown, context?: LogContext) => {
    emit('error', event, { ...(context || {}), error })
  },
}

export type Logger = typeof logger
