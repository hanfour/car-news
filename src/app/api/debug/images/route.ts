import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceClient()

  // Check total articles
  const { count: total } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })

  // Check articles with images
  const { count: withImages } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .not('image_url', 'is', null)

  // Get recent articles
  const { data: recent } = await supabase
    .from('raw_articles')
    .select('url, title, image_url, image_credit, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    stats: {
      total,
      withImages,
      withoutImages: total! - withImages!,
      percentage: Math.round((withImages! / total!) * 100)
    },
    recentArticles: recent?.map(a => ({
      title: a.title.slice(0, 80),
      hasImage: !!a.image_url,
      imageUrl: a.image_url?.slice(0, 50),
      credit: a.image_credit,
      createdAt: a.created_at
    }))
  })
}
