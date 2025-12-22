import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'
import { getErrorMessage } from '@/lib/utils/error'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.MIGRATION_TOKEN || 'your-secret-migration-token'

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/005_add_user_system.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  try {
    console.log('→ Executing user system migration...')

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    const results = []

    for (const statement of statements) {
      try {
        const { data, error } = await supabase.rpc('exec', { sql: statement + ';' })
        if (error) {
          console.error(`✗ Error executing statement:`, error)
          results.push({ statement: statement.substring(0, 100), error: error.message })
        } else {
          results.push({ statement: statement.substring(0, 100), success: true })
        }
      } catch (err) {
        console.error(`✗ Exception:`, err)
        results.push({ statement: statement.substring(0, 100), error: getErrorMessage(err) })
      }
    }

    return NextResponse.json({
      message: 'Migration completed',
      results,
      totalStatements: statements.length
    })
  } catch (error) {
    console.error('✗ Migration failed:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: getErrorMessage(error),
      instructions: [
        '請手動執行 migration：',
        '1. 打開 Supabase Dashboard',
        '2. 進入 SQL Editor',
        '3. 貼上 supabase/migrations/005_add_user_system.sql 內容',
        '4. 點擊 Run'
      ]
    }, { status: 500 })
  }
}
