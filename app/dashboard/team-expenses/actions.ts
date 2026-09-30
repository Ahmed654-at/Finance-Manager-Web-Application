'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

export async function createTeamExpense(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const submittedByName = (formData.get('submitted_by_name') as string | null)?.trim() ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const amount = parseFloat((formData.get('amount') as string) || '0')
  const expenseDate = (formData.get('expense_date') as string | null) || new Date().toISOString().slice(0, 10)
  const categoryId = (formData.get('category_id') as string | null) || null
  const accountId = (formData.get('account_id') as string | null) || null
  const status = (formData.get('status') as string) || 'approved'
  const receiptUrl = (formData.get('receipt_url') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!submittedByName || !title || amount <= 0) {
    return { error: 'Please provide team member name, title, and valid amount.' }
  }

  let transactionId: string | null = null

  // If status is reimbursed, auto-create financial transaction
  if (status === 'reimbursed') {
    const { data: tx } = await supabase
      .from('transactions')
      .insert({
        company_id: companyId,
        type: 'expense',
        expense_type: 'team_expense',
        amount,
        category_id: categoryId,
        account_id: accountId,
        description: `Team Reimbursement: ${title} (${submittedByName})`,
        transaction_date: expenseDate,
        reference: `REIMB-${Date.now().toString().slice(-6)}`,
        created_by: user.id,
      })
      .select('id')
      .single()

    transactionId = tx?.id || null

    if (accountId) {
      const { data: acc } = await supabase.from('accounts').select('opening_balance').eq('id', accountId).single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ opening_balance: Number(acc.opening_balance || 0) - amount })
          .eq('id', accountId)
      }
    }
  }

  const { error } = await supabase.from('team_expenses').insert({
    company_id: companyId,
    submitted_by_name: submittedByName,
    category_id: categoryId,
    title,
    amount,
    expense_date: expenseDate,
    status,
    account_id: accountId,
    transaction_id: transactionId,
    receipt_url: receiptUrl,
    notes,
  })

  if (error) {
    return { error: error.message || 'Could not record team expense.' }
  }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: 'created',
    entity_type: 'team_expense',
    summary: `Logged team expense "${title}" of ${amount} for ${submittedByName}`,
  })

  revalidatePath('/dashboard/team-expenses')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function markExpenseReimbursed(expenseId: string, accountId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin' && role !== 'accountant') {
    return { error: 'Permission denied.' }
  }

  const { data: expense } = await supabase
    .from('team_expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .single()

  if (!expense) return { error: 'Expense record not found.' }
  if (expense.status === 'reimbursed') return { success: true }

  const paidFromAccount = accountId || expense.account_id

  // 1. Record transaction
  const { data: tx } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      type: 'expense',
      expense_type: 'team_expense',
      amount: expense.amount,
      category_id: expense.category_id,
      account_id: paidFromAccount,
      description: `Team Reimbursement: ${expense.title} (${expense.submitted_by_name})`,
      transaction_date: new Date().toISOString().slice(0, 10),
      reference: `REIMB-${Date.now().toString().slice(-6)}`,
      created_by: user.id,
    })
    .select('id')
    .single()

  // 2. Update account balance
  if (paidFromAccount) {
    const { data: acc } = await supabase.from('accounts').select('opening_balance').eq('id', paidFromAccount).single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ opening_balance: Number(acc.opening_balance || 0) - Number(expense.amount) })
        .eq('id', paidFromAccount)
    }
  }

  // 3. Update expense status
  await supabase
    .from('team_expenses')
    .update({
      status: 'reimbursed',
      account_id: paidFromAccount,
      transaction_id: tx?.id || null,
    })
    .eq('id', expenseId)

  revalidatePath('/dashboard/team-expenses')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

async function reviewExpense(expenseId: string, decision: 'approved' | 'rejected', note?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Only an owner or admin can approve or reject expense requests.' }
  }

  const { data: expense } = await supabase
    .from('team_expenses')
    .select('id, title, amount, status, submitted_by')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!expense) return { error: 'Expense request not found.' }
  if (expense.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const { error } = await supabase
    .from('team_expenses')
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || null,
    })
    .eq('id', expenseId)
    .eq('company_id', companyId)

  if (error) return { error: error.message || 'Could not update the request.' }

  if (expense.submitted_by) {
    await supabase.from('notifications').insert({
      company_id: companyId,
      user_id: expense.submitted_by,
      message: `Your expense request "${expense.title}" was ${decision}.${note?.trim() ? ` Note: ${note.trim()}` : ''}`,
      is_read: false,
    })
  }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: decision,
    entity_type: 'team_expense',
    entity_id: expenseId,
    summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} expense request "${expense.title}"`,
  })

  revalidatePath('/dashboard/team-expenses')
  return { success: true }
}

export async function approveExpense(expenseId: string) {
  return reviewExpense(expenseId, 'approved')
}

export async function rejectExpense(expenseId: string, note?: string) {
  return reviewExpense(expenseId, 'rejected', note)
}

export async function deleteTeamExpense(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Permission denied.' }
  }

  const { error } = await supabase
    .from('team_expenses')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: error.message || 'Could not delete expense claim.' }
  }

  revalidatePath('/dashboard/team-expenses')
  return { success: true }
}
