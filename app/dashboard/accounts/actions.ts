'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

const ACCOUNT_TYPES = ['cash', 'bank', 'credit', 'savings']

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

  if (!ACCOUNT_TYPES.includes(type)) {
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

export async function updateAccount(accountId: string, formData: FormData) {
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
  const isActive = formData.get('is_active') === 'on'

  if (!name) {
    return { error: 'Account name is required.' }
  }

  if (!ACCOUNT_TYPES.includes(type)) {
    return { error: 'Please select a valid account type.' }
  }

  if (!Number.isFinite(openingBalanceValue)) {
    return { error: 'Opening balance must be a valid number.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('accounts')
    .update({
      name,
      type,
      opening_balance: openingBalanceValue,
      is_active: isActive,
    })
    .eq('id', accountId)
    .eq('company_id', companyId)
    .select('id')

  if (updateError) {
    return { error: updateError.message || 'Could not update account. Please try again.' }
  }

  if (!updated || updated.length === 0) {
    return { error: 'Account not found.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'updated',
    entityType: 'account',
    entityId: accountId,
    summary: `Updated ${type} account "${name}"${isActive ? '' : ' (marked inactive)'}`,
  })

  revalidatePath('/dashboard/accounts')
  redirect('/dashboard/accounts')
}

export async function deleteAccount(accountId: string) {
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

  const { data: account } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!account) {
    return { error: 'Account not found.' }
  }

  // Deleting an account that has history would detach those records and change every balance,
  // so it is refused. The account can be marked inactive instead.
  const [{ count: transactionCount }, { count: salaryCount }, { count: expenseCount }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('account_id', accountId),
    supabase
      .from('salaries')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('account_id', accountId),
    supabase
      .from('team_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('account_id', accountId),
  ])

  if ((transactionCount ?? 0) + (salaryCount ?? 0) + (expenseCount ?? 0) > 0) {
    return {
      error: `"${account.name}" has transactions or payments linked to it, so it cannot be deleted. Edit it and untick "Active" to hide it instead.`,
    }
  }

  const { error: deleteError } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: deleteError.message || 'Could not delete account. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'deleted',
    entityType: 'account',
    entityId: accountId,
    summary: `Deleted account "${account.name}"`,
  })

  revalidatePath('/dashboard/accounts')
  redirect('/dashboard/accounts')
}