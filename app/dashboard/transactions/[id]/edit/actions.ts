'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function updateTransaction(transactionId: string, formData: FormData) {
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

  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!existingTransaction) {
    return { error: 'Transaction not found.' }
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      type,
      amount: amountValue,
      category_id: categoryId,
      account_id: accountId,
      description: description || null,
      transaction_date: transactionDate,
      reference: reference || null,
    })
    .eq('id', transactionId)
    .eq('company_id', membership.company_id)

  if (updateError) {
    return { error: 'Could not update transaction. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'updated',
    entityType: 'transaction',
    entityId: transactionId,
    summary: `Updated ${type} transaction of ${amountValue} in ${categoryId ? 'a category' : 'no category'}`,
  })

  revalidatePath('/dashboard/transactions')
  redirect('/dashboard/transactions')
}

export async function deleteTransaction(transactionId: string) {
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

  const { data: transactionToDelete } = await supabase
    .from('transactions')
    .select('id, type, amount')
    .eq('id', transactionId)
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!transactionToDelete) {
    return { error: 'Transaction not found.' }
  }

  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('company_id', membership.company_id)

  if (deleteError) {
    return { error: 'Could not delete transaction. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'deleted',
    entityType: 'transaction',
    entityId: transactionId,
    summary: `Deleted ${transactionToDelete.type} transaction of ${transactionToDelete.amount}`,
  })

  revalidatePath('/dashboard/transactions')
  redirect('/dashboard/transactions')
}
