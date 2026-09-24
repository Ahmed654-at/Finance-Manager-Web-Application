'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const name = String(formData.get('name') ?? '').trim()
  const type = String(formData.get('type') ?? '').trim()
  const openingBalanceValue = Number(formData.get('opening_balance'))

  if (!name) {
    return { error: 'Account name is required.' }
  }

  if (!['cash', 'bank', 'credit'].includes(type)) {
    return { error: 'Please select a valid account type.' }
  }

  if (!Number.isFinite(openingBalanceValue)) {
    return { error: 'Opening balance must be a valid number.' }
  }

  const { data: account, error: insertError } = await supabase
    .from('accounts')
    .insert({
      company_id: membership.company_id,
      name,
      type,
      opening_balance: openingBalanceValue,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !account?.id) {
    return { error: 'Could not create account. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'created',
    entityType: 'account',
    entityId: account.id,
    summary: `Created ${type} account "${name}"`,
  })

  revalidatePath('/dashboard/accounts')
  redirect('/dashboard/accounts')
}