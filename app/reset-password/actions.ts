'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MIN_LENGTH = 8

function fail(message: string): never {
  redirect(`/reset-password?error=${encodeURIComponent(message)}`)
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The reset link signs the person in; without that session there is nothing to reset.
  if (!user) {
    redirect('/forgot-password?error=' + encodeURIComponent('That reset link has expired. Request a new one.'))
  }

  const newPassword = String(formData.get('new_password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (newPassword.length < MIN_LENGTH) fail(`The password must be at least ${MIN_LENGTH} characters.`)
  if (newPassword !== confirmPassword) fail('The password and its confirmation do not match.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) fail(error.message || 'Could not reset the password.')

  redirect('/dashboard')
}
