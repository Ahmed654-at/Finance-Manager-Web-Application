'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { checkBudgetAlerts } from '../../notifications/actions'

export async function createTransaction(formData: FormData) {
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

  const type = String(formData.get('type') ?? '').trim()
  const amountValue = Number(formData.get('amount'))
  const transactionDate = String(formData.get('transaction_date') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const reference = String(formData.get('reference') ?? '').trim()
  const rawCategoryId = formData.get('category_id')
  const categoryId = rawCategoryId && String(rawCategoryId).trim() !== '' ? String(rawCategoryId) : null
  const rawAccountId = formData.get('account_id')
  const accountId = rawAccountId && String(rawAccountId).trim() !== '' ? String(rawAccountId) : null

  if (!['income', 'expense'].includes(type)) {
    return { error: 'Please select a valid transaction type.' }
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: 'Amount must be a positive number.' }
  }

  if (!transactionDate) {
    return { error: 'Transaction date is required.' }
  }

  const { data: transaction, error: insertError } = await supabase
    .from('transactions')
    .insert({
      company_id: membership.company_id,
      type,
      amount: amountValue,
      category_id: categoryId,
      account_id: accountId,
      description: description || null,
      transaction_date: transactionDate,
      reference: reference || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !transaction?.id) {
    return { error: 'Could not create transaction. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'created',
    entityType: 'transaction',
    entityId: transaction.id,
    summary: `Created ${type} transaction of ${amountValue} in ${categoryId ? 'a category' : 'no category'}`,
  })

  if (type === 'expense' && categoryId) {
    await checkBudgetAlerts(membership.company_id, categoryId)
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
