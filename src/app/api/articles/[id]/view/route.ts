import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Increment article view count
 * Uses atomic update to prevent race conditions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()

    // Use atomic SQL increment to avoid race conditions
    // This is better than read-modify-write cycle
    const { error } = await supabase
      .rpc('increment_view_count', { article_id: id })

    if (error) {
      console.error('Failed to increment view count:', error)
      return NextResponse.json(
        { error: 'Failed to update view count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('View count error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
