import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params
    const { reason, description } = await request.json()

    // Validate reason
    const validReasons = ['spam', 'misinformation', 'inappropriate', 'copyright', 'other']
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json({ error: '無效的檢舉原因' }, { status: 400 })
    }

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // Check if article exists
    const { data: article, error: articleError } = await supabase
      .from('generated_articles')
      .select('id')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    // Check if user already reported this article
    const { data: existingReport } = await supabase
      .from('article_reports')
      .select('id')
      .eq('article_id', articleId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: '您已經檢舉過此文章' }, { status: 400 })
    }

    // Create report
    const { error: insertError } = await supabase
      .from('article_reports')
      .insert({
        article_id: articleId,
        user_id: userId,
        reason,
        description: description || null,
        status: 'pending'
      })

    if (insertError) {
      logger.error('api.articles.report_create_fail', insertError, { articleId, userId })
      return NextResponse.json({ error: '檢舉失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '檢舉已提交，我們會盡快處理'
    })

  } catch (error) {
    logger.error('api.articles.report_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: getErrorMessage(error) || '檢舉失敗' },
      { status: 500 }
    )
  }
}
