'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { getAccountName } from '@/lib/user'

const PURPOSES = ['project', 'marketing', 'other'] as const

export async function submitMyExpense(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId } = await getCompanyContext(supabase, user)

  const title = String(formData.get('title') ?? '').trim()
  const amount = Math.round(Number(formData.get('amount')) * 100) / 100
  const expenseDate = String(formData.get('expense_date') ?? '').trim() || new Date().toISOString().slice(0, 10)
  const purpose = String(formData.get('purpose') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  const receiptUrl = String(formData.get('receipt_url') ?? '').trim() || null

  if (!title) {
    redirect('/my-expenses?error=' + encodeURIComponent('Please describe the expense.'))
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect('/my-expenses?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!(PURPOSES as readonly string[]).includes(purpose)) {
    redirect('/my-expenses?error=' + encodeURIComponent('Choose project, marketing or other.'))
  }

  const submittedByName = await getAccountName(supabase, user)

  // Always filed as pending and as this user: the database policy enforces the same rules.
  const { error } = await supabase.from('team_expenses').insert({
    company_id: companyId,
    submitted_by: user.id,
    submitted_by_name: submittedByName,
    title,
    amount,
    expense_date: expenseDate,
    purpose,
    status: 'pending',
    receipt_url: receiptUrl,
    notes,
  })

  if (error) {
    redirect('/my-expenses?error=' + encodeURIComponent(error.message || 'Could not submit the request.'))
  }

  // Let owners and admins know there is something to approve.
  const { data: reviewers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role', ['owner', 'admin'])

  if (reviewers && reviewers.length > 0) {
    await supabase.from('notifications').insert(
      reviewers.map((reviewer) => ({
        company_id: companyId,
        user_id: reviewer.user_id,
        message: `${submittedByName} requested approval for an expense: "${title}" (${amount}, ${purpose}).`,
        is_read: false,
      })),
    )
  }

  revalidatePath('/my-expenses')
  revalidatePath('/dashboard/team-expenses')
  redirect('/my-expenses?success=' + encodeURIComponent('Request sent for approval.'))
}

export async function submitMySalary(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId } = await getCompanyContext(supabase, user)

  const paymentMonth = String(formData.get('payment_month') ?? '').trim()
  const amount = Math.round(Number(formData.get('amount')) * 100) / 100
  const notes = String(formData.get('notes') ?? '').trim() || null

  const fail = (message: string): never => redirect('/my-expenses?error=' + encodeURIComponent(message))

  if (!paymentMonth) fail('Enter the salary month, e.g. October 2026.')
  if (!Number.isFinite(amount) || amount <= 0) fail('Enter an amount greater than zero.')

  // Don't allow a second open request for the same month.
  const { data: existing } = await supabase
    .from('salary_requests')
    .select('id')
    .eq('company_id', companyId)
    .eq('submitted_by', user.id)
    .ilike('payment_month', paymentMonth)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle()

  if (existing) fail(`You already have a pending or paid salary request for ${paymentMonth}.`)

  const submittedByName = await getAccountName(supabase, user)

  const { error } = await supabase.from('salary_requests').insert({
    company_id: companyId,
    submitted_by: user.id,
    submitted_by_name: submittedByName,
    payment_month: paymentMonth,
    amount,
    status: 'pending',
    notes,
  })

  if (error) fail(error.message || 'Could not submit the salary request.')

  const { data: reviewers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role', ['owner', 'admin'])

  if (reviewers && reviewers.length > 0) {
    await supabase.from('notifications').insert(
      reviewers.map((reviewer) => ({
        company_id: companyId,
        user_id: reviewer.user_id,
        message: `${submittedByName} requested their ${paymentMonth} salary (${amount}) for approval.`,
        is_read: false,
      })),
    )
  }

  revalidatePath('/my-expenses')
  revalidatePath('/dashboard/salary-requests')
  redirect('/my-expenses?success=' + encodeURIComponent('Salary request sent for approval.'))
}
