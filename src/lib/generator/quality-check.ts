import { GenerateArticleOutput } from '@/lib/ai/claude'

export interface PublishDecision {
  shouldPublish: boolean
  reason: string
}

export function decidePublish(article: GenerateArticleOutput): PublishDecision {
  const checks = article.quality_checks
  const conf = article.confidence

  // 第一层：硬性拒绝
  if (!checks.has_sources) {
    return {
      shouldPublish: false,
      reason: '缺少來源標註'
    }
  }

  if (checks.has_banned_words) {
    return {
      shouldPublish: false,
      reason: '包含禁用詞'
    }
  }

  if (checks.has_unverified) {
    return {
      shouldPublish: false,
      reason: '包含未驗證表述'
    }
  }

  // 第二层：综合判断
  if (conf >= 90 && checks.has_data && checks.structure_valid) {
    return {
      shouldPublish: true,
      reason: '高質量文章'
    }
  }

  if (conf >= 80 && checks.has_data) {
    return {
      shouldPublish: true,
      reason: '合格文章'
    }
  }

  if (conf >= 70) {
    return {
      shouldPublish: false,
      reason: `置信度略低(${conf})，建議人工審核`
    }
  }

  // 第三层：默认拒绝
  return {
    shouldPublish: false,
    reason: `置信度過低(${conf})`
  }
}
