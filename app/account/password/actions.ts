'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MIN_LENGTH = 8

function fail(message: string): never {
  redirect(`/account/password?error=${encodeURIComponent(message)}`)
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) redirect('/login')

  const currentPassword = String(formData.get('current_password') ?? '')
  const newPassword = String(formData.get('new_password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (!currentPassword) fail('Enter your current password.')
  if (newPassword.length < MIN_LENGTH) fail(`The new password must be at least ${MIN_LENGTH} characters.`)
  if (newPassword !== confirmPassword) fail('The new password and its confirmation do not match.')
  if (newPassword === currentPassword) fail('Choose a password different from your current one.')

  // Prove the person at the keyboard knows the current password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (verifyError) fail('Your current password is incorrect.')

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

  if (updateError) fail(updateError.message || 'Could not change the password.')

  redirect(`/account/password?success=${encodeURIComponent('Password changed.')}`)
}
