import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // 獲取時間範圍
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // 1. 最近1小時生成的文章
    const { data: lastHour, count: lastHourCount } = await supabase
      .from('generated_articles')
      .select('brand, title_zh, created_at', { count: 'exact' })
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })

    // 2. 最近24小時生成的文章
    const { data: last24h } = await supabase
      .from('generated_articles')
      .select('brand, created_at')
      .gte('created_at', oneDayAgo.toISOString())

    // 3. 最近3天生成的文章
    const { data: last3days } = await supabase
      .from('generated_articles')
      .select('brand, created_at')
      .gte('created_at', threeDaysAgo.toISOString())

    // 4. Raw articles 統計
    const { data: rawArticles, count: rawCount } = await supabase
      .from('raw_articles')
      .select('brand, title', { count: 'exact' })
      .gt('expires_at', new Date().toISOString())

    // 計算品牌分布
    const calculateBrandDistribution = (articles: Array<{ brand?: string | null }>) => {
      const brandCount = new Map<string, number>()
      articles.forEach(a => {
        const brand = a.brand || 'Unknown'
        brandCount.set(brand, (brandCount.get(brand) || 0) + 1)
      })
      return Array.from(brandCount.entries())
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count)
    }

    const lastHourBrands = calculateBrandDistribution(lastHour || [])
    const last24hBrands = calculateBrandDistribution(last24h || [])
    const last3daysBrands = calculateBrandDistribution(last3days || [])

    // 計算 raw articles 品牌分布
    const rawBrandCount = new Map<string, number>()
    ;(rawArticles || []).forEach(a => {
      const brand = a.brand || 'Other'
      rawBrandCount.set(brand, (rawBrandCount.get(brand) || 0) + 1)
    })
    const rawBrandDistribution = Array.from(rawBrandCount.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15) // 只返回前15個品牌

    // 檢查品牌多樣性健康度
    const teslaCount = last24hBrands.find(b => b.brand === 'Tesla')?.count || 0
    const totalLast24h = last24h?.length || 0
    const teslaPercentage = totalLast24h > 0 ? (teslaCount / totalLast24h) * 100 : 0

    let healthStatus: 'healthy' | 'warning' | 'critical'
    if (teslaPercentage > 80) {
      healthStatus = 'critical'
    } else if (teslaPercentage > 50) {
      healthStatus = 'warning'
    } else {
      healthStatus = 'healthy'
    }

    // 檢查是否有品牌超過配額
    const brandsOverQuota = lastHourBrands.filter(b => b.count > 3)

    return NextResponse.json({
      lastHour: {
        count: lastHourCount || 0,
        brands: lastHourBrands,
        articles: (lastHour || []).slice(0, 5) // 最新5篇
      },
      last24h: {
        count: totalLast24h,
        brands: last24hBrands
      },
      last3days: {
        count: last3days?.length || 0,
        brands: last3daysBrands
      },
      rawArticles: {
        count: rawCount || 0,
        brands: rawBrandDistribution
      },
      health: {
        status: healthStatus,
        teslaPercentage,
        uniqueBrands: last24hBrands.length,
        brandsOverQuota
      }
    })
  } catch (error) {
    console.error('Generator stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
