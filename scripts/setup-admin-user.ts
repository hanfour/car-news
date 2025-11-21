import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function setupAdminUser() {
  const adminEmail = 'hanfourhuang@gmail.com'

  console.log('=== Setting up Admin User ===')
  console.log('Email:', adminEmail)

  // 1. Find user by email
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('Error listing users:', userError)
    return
  }

  const user = users.users.find((u) => u.email === adminEmail)

  if (!user) {
    console.error('❌ User not found:', adminEmail)
    console.log('Please sign in to the website first to create your account.')
    return
  }

  console.log('✅ User found:', user.id)

  // 2. Check if profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.log('Profile query error:', profileError)

    // Try to create profile if it doesn't exist
    console.log('Creating profile...')
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url,
        is_admin: true
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Failed to create profile:', createError)
      return
    }

    console.log('✅ Profile created with admin rights:', newProfile)
    return
  }

  console.log('Profile found:', profile)

  // 3. Update profile to set is_admin = true
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    console.error('❌ Failed to update profile:', updateError)
    return
  }

  console.log('✅ Admin rights granted!')
  console.log('Updated profile:', updated)
}

setupAdminUser()
