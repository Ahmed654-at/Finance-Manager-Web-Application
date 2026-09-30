import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  // 303 makes the browser follow the redirect with a GET. A plain redirect (307) would repeat the
  // POST against /login, which only serves pages, and fail with HTTP 405.
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
      303,
    )
  }

  return NextResponse.redirect(new URL('/login', request.url), 303)
}
