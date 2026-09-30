'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

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
      company_id: companyId,
      name,
      type,
      opening_balance: openingBalanceValue,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !account?.id) {
    return { error: insertError?.message || 'Could not create account. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'created',
    entityType: 'account',
    entityId: account.id,
    summary: `Created ${type} account "${name}"`,
  })

  revalidatePath('/dashboard/accounts')
  redirect('/dashboard/accounts')
}