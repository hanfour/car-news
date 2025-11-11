import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST() {
  const supabase = createServiceClient()

  console.log('Deleting raw_articles...')
  const { error: deleteRawError } = await supabase
    .from('raw_articles')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (deleteRawError) {
    return NextResponse.json({ error: deleteRawError.message }, { status: 500 })
  }

  console.log('Deleting daily_topic_locks...')
  const { error: deleteLocksError } = await supabase
    .from('daily_topic_locks')
    .delete()
    .neq('date', '1900-01-01') // Delete all

  if (deleteLocksError) {
    return NextResponse.json({ error: deleteLocksError.message }, { status: 500 })
  }

  console.log('Reset complete!')
  return NextResponse.json({
    success: true,
    message: 'Deleted all raw_articles and daily_topic_locks'
  })
}
