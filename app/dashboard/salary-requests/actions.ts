'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { findPayrollEmployee } from '@/lib/payroll'

async function requireReviewer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  return { supabase, user, companyId, canReview: role === 'owner' || role === 'admin' }
}

export async function approveSalaryRequest(requestId: string, accountId?: string) {
  const { supabase, user, companyId, canReview } = await requireReviewer()
  if (!canReview) return { error: 'Only an owner or admin can approve salary requests.' }

  const { data: request } = await supabase
    .from('salary_requests')
    .select('*')
    .eq('id', requestId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!request) return { error: 'Salary request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const chosenAccount = accountId || null
  const amount = Number(request.amount)
  const today = new Date().toISOString().slice(0, 10)

  // 1. Claim the request atomically (only one reviewer/click can move it out of "pending").
  const { data: claimed } = await supabase
    .from('salary_requests')
    .update({
      status: 'approved',
      account_id: chosenAccount,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select('id')

  if (!claimed || claimed.length === 0) {
    return { error: 'This request has already been reviewed.' }
  }

  const releaseClaim = () =>
    supabase
      .from('salary_requests')
      .update({ status: 'pending', account_id: null, reviewed_by: null, reviewed_at: null })
      .eq('id', requestId)
      .eq('company_id', companyId)

  // 2. Link to the payroll profile on the Employees page (matched by login email, then by name).
  const profile = await findPayrollEmployee(supabase, companyId, request.submitted_by, request.submitted_by_name)
  const payrollEmployeeId: string | null = profile?.id ?? null

  // 3. Category, same lookup as regular payroll.
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', '%Salary%')
    .limit(1)
    .maybeSingle()

  // 4. Salary expense in the ledger.
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      type: 'expense',
      expense_type: 'salary',
      amount,
      category_id: cat?.id ?? null,
      account_id: chosenAccount,
      employee_id: payrollEmployeeId,
      description: `Salary: ${request.submitted_by_name} (${request.payment_month})`,
      transaction_date: today,
      reference: `PAYROLL-${String(request.payment_month).replace(/\s+/g, '-').toUpperCase()}`,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    await releaseClaim()
    return { error: txError?.message || 'Could not record the salary expense.' }
  }

  // 5. Payroll record (only possible when a matching employee profile exists).
  if (payrollEmployeeId) {
    await supabase.from('salaries').insert({
      company_id: companyId,
      employee_id: payrollEmployeeId,
      amount,
      bonus: 0,
      deductions: 0,
      net_amount: amount,
      payment_date: today,
      payment_month: request.payment_month,
      status: 'paid',
      account_id: chosenAccount,
      transaction_id: tx.id,
      notes: request.notes,
    })
  }

  await supabase
    .from('salary_requests')
    .update({ transaction_id: tx.id })
    .eq('id', requestId)
    .eq('company_id', companyId)

  // 6. Deduct from the account balance (same convention as regular payroll).
  if (chosenAccount) {
    const { data: account } = await supabase
      .from('accounts')
      .select('opening_balance')
      .eq('id', chosenAccount)
      .maybeSingle()

    if (account) {
      await supabase
        .from('accounts')
        .update({ opening_balance: Number(account.opening_balance || 0) - amount })
        .eq('id', chosenAccount)
    }
  }

  await notifyAndAudit(supabase, {
    companyId,
    reviewerId: user.id,
    request,
    decision: 'approved',
  })

  revalidatePath('/dashboard/salary-requests')
  revalidatePath('/dashboard/employees')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function rejectSalaryRequest(requestId: string, note?: string) {
  const { supabase, user, companyId, canReview } = await requireReviewer()
  if (!canReview) return { error: 'Only an owner or admin can reject salary requests.' }

  const { data: request } = await supabase
    .from('salary_requests')
    .select('*')
    .eq('id', requestId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!request) return { error: 'Salary request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const { error } = await supabase
    .from('salary_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || null,
    })
    .eq('id', requestId)
    .eq('company_id', companyId)
    .eq('status', 'pending')

  if (error) return { error: error.message || 'Could not reject the request.' }

  await notifyAndAudit(supabase, {
    companyId,
    reviewerId: user.id,
    request,
    decision: 'rejected',
    note,
  })

  revalidatePath('/dashboard/salary-requests')
  return { success: true }
}

async function notifyAndAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    companyId: string
    reviewerId: string
    request: { id: string; payment_month: string; submitted_by: string | null }
    decision: 'approved' | 'rejected'
    note?: string
  },
) {
  const { companyId, reviewerId, request, decision, note } = params

  if (request.submitted_by) {
    await supabase.from('notifications').insert({
      company_id: companyId,
      user_id: request.submitted_by,
      message: `Your ${request.payment_month} salary request was ${decision}.${note?.trim() ? ` Note: ${note.trim()}` : ''}`,
      is_read: false,
    })
  }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: reviewerId,
    action: decision,
    entity_type: 'salary_request',
    entity_id: request.id,
    summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${request.payment_month} salary request`,
  })
}
