import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only follow same-site relative paths, never an external URL.
function safeNext(value: string | null) {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return value
  }
  return '/dashboard'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/forgot-password?error=${encodeURIComponent('That reset link is invalid or has expired. Request a new one.')}`,
  )
}
