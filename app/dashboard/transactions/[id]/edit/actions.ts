'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

export async function updateTransaction(transactionId: string, formData: FormData) {
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
    .eq('company_id', companyId)
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
    .eq('company_id', companyId)

  if (updateError) {
    return { error: updateError?.message || 'Could not update transaction. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'updated',
    entityType: 'transaction',
    entityId: transactionId,
    summary: `Updated transaction ${transactionId} to ${type} ${amountValue}`,
  })

  revalidatePath('/dashboard')
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

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const { data: transactionToDelete } = await supabase
    .from('transactions')
    .select('id, type, amount')
    .eq('id', transactionId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!transactionToDelete) {
    return { error: 'Transaction not found.' }
  }

  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: deleteError?.message || 'Could not delete transaction. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'deleted',
    entityType: 'transaction',
    entityId: transactionId,
    summary: `Deleted ${transactionToDelete.type} transaction of ${transactionToDelete.amount}`,
  })

  revalidatePath('/dashboard/transactions')
  redirect('/dashboard/transactions')
}
