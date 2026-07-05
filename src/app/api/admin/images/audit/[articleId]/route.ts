import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyAdminAuth } from '@/lib/admin/auth'

// GET /api/admin/images/audit/[articleId] — get latest audit for a single article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { articleId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('image_audit')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ audit: null })
  }

  return NextResponse.json({ audit: data })
}
