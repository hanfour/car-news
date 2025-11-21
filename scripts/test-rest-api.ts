import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function testRestAPI() {
  const userId = '07a53b42-70fd-4680-b91f-4942eda347b1'
  const url = `${supabaseUrl}/rest/v1/profiles?select=*&id=eq.${userId}`

  console.log('Testing REST API...')
  console.log('URL:', url)
  console.log('Has anon key:', !!anonKey)
  console.log('')

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      }
    })

    console.log('Status:', response.status, response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))
    console.log('')

    const text = await response.text()
    console.log('Response body:', text)

    if (!response.ok) {
      console.error('\n❌ Request failed')
      console.error('This might be due to:')
      console.error('1. RLS policies blocking access')
      console.error('2. Database function/trigger error')
      console.error('3. PostgREST configuration issue')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testRestAPI()
