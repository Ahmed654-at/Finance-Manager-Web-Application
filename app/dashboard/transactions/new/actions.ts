'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'
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

  const revenueStream = type === 'income' ? ((formData.get('revenue_stream') as string | null) || 'ai_services') : null
  const expenseType = type === 'expense' ? ((formData.get('expense_type') as string | null) || 'operational') : null

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
      company_id: companyId,
      type,
      amount: amountValue,
      category_id: categoryId,
      account_id: accountId,
      revenue_stream: revenueStream,
      expense_type: expenseType,
      description: description || null,
      transaction_date: transactionDate,
      reference: reference || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !transaction?.id) {
    console.error('Create transaction error:', insertError)
    return { error: insertError?.message || 'Could not create transaction. Please try again.' }
  }

  if (accountId) {
    const { data: acc } = await supabase.from('accounts').select('opening_balance').eq('id', accountId).single()
    if (acc) {
      const delta = type === 'income' ? amountValue : -amountValue
      await supabase
        .from('accounts')
        .update({ opening_balance: Number(acc.opening_balance || 0) + delta })
        .eq('id', accountId)
    }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'created',
    entityType: 'transaction',
    entityId: transaction.id,
    summary: `Created ${type} transaction of ${amountValue} in ${categoryId ? 'a category' : 'no category'}`,
  })

  if (type === 'expense' && categoryId) {
    await checkBudgetAlerts(companyId, categoryId)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transactions')
  redirect('/dashboard/transactions')
}
