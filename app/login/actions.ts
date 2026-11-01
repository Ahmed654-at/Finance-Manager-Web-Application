'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (password.length < 8) {
    redirect(`/login?error=${encodeURIComponent('Your password must be at least 8 characters.')}`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // With email confirmation turned on there is no session yet. Say so instead of
  // sending them to the dashboard, which would bounce them back to a blank login page.
  if (!data.session) {
    redirect(
      `/login?notice=${encodeURIComponent('Account created. Check your email and click the confirmation link, then sign in.')}`,
    )
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
