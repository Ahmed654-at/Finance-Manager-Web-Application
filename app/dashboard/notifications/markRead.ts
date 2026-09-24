'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return { error: 'Unauthorized' }
  }

  const { error: updateError } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: 'Could not mark notification as read.' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
