import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://odetecnsfwvugnrfynmi.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXRlY25zZnd2dWducmZ5bm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk1NTMsImV4cCI6MjA5MTc0NTU1M30.fuQeIRFINuVQInL3USv_aHtdO-Q3rPaRS0xy1Vpuyh8'

const supabase = createClient(SUPABASE_URL, ANON_KEY)
const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@test.com', password: 'poiu0987' })

if (error) {
  console.log('login error:', error.message)
  process.exit(1)
}

const session = data.session
const cookieValue = JSON.stringify({
  access_token: session.access_token,
  token_type: session.token_type,
  expires_in: session.expires_in,
  expires_at: session.expires_at,
  refresh_token: session.refresh_token,
  user: session.user,
})

console.log('user.id:', session.user.id)
console.log('cookie length:', ('sb-odetecnsfwvugnrfynmi-auth-token=' + encodeURIComponent(cookieValue)).length)
