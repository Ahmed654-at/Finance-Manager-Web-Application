'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'


export async function updateEmployee(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Permission denied.' }
  }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() || null
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const designation = (formData.get('designation') as string | null)?.trim() ?? ''
  const department = (formData.get('department') as string | null)?.trim() || 'AI Services'
  const salaryAmount = parseFloat((formData.get('salary_amount') as string) || '0')
  const status = (formData.get('status') as string) || 'active'
  const paymentMethod = (formData.get('payment_method') as string) || 'bank_transfer'
  const bankAccountDetails = (formData.get('bank_account_details') as string | null)?.trim() || null

  if (!id || !name || !designation) {
    return { error: 'Invalid details provided.' }
  }

  const { error } = await supabase
    .from('employees')
    .update({
      name,
      email,
      phone,
      designation,
      department,
      salary_amount: isNaN(salaryAmount) ? 0 : salaryAmount,
      status,
      payment_method: paymentMethod,
      bank_account_details: bankAccountDetails,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: error.message || 'Could not update employee.' }
  }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Permission denied.' }
  }

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: error.message || 'Could not delete employee.' }
  }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function disburseSalary(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin' && role !== 'accountant') {
    return { error: 'Permission denied.' }
  }

  const employeeId = formData.get('employee_id') as string
  const paymentMonth = (formData.get('payment_month') as string | null)?.trim() || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const paymentDate = (formData.get('payment_date') as string | null) || new Date().toISOString().slice(0, 10)
  const amount = parseFloat((formData.get('amount') as string) || '0')
  const bonus = parseFloat((formData.get('bonus') as string) || '0')
  const deductions = parseFloat((formData.get('deductions') as string) || '0')
  const accountId = (formData.get('account_id') as string | null) || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!employeeId || amount <= 0) {
    return { error: 'Valid employee and base salary amount are required.' }
  }

  const netAmount = amount + (isNaN(bonus) ? 0 : bonus) - (isNaN(deductions) ? 0 : deductions)
  if (netAmount <= 0) {
    return { error: 'Net salary must be greater than zero.' }
  }

  // Get employee name
  const { data: employee } = await supabase
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .single()

  const empName = employee?.name || 'Employee'

  // Find or create 'Employee Salaries & Payroll' category
  let categoryId: string | null = null
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', '%Salary%')
    .limit(1)
    .maybeSingle()

  if (cat) {
    categoryId = cat.id
  }

  // 1. Create financial transaction in double-entry ledger
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      type: 'expense',
      expense_type: 'salary',
      amount: netAmount,
      category_id: categoryId,
      account_id: accountId,
      employee_id: employeeId,
      description: `Salary: ${empName} (${paymentMonth})`,
      transaction_date: paymentDate,
      reference: `PAYROLL-${paymentMonth.replace(/\s+/g, '-').toUpperCase()}`,
      created_by: user.id,
    })
    .select('id')
    .single()

  // 2. Insert into salaries table
  const { error: salError } = await supabase.from('salaries').insert({
    company_id: companyId,
    employee_id: employeeId,
    amount,
    bonus: isNaN(bonus) ? 0 : bonus,
    deductions: isNaN(deductions) ? 0 : deductions,
    net_amount: netAmount,
    payment_date: paymentDate,
    payment_month: paymentMonth,
    status: 'paid',
    account_id: accountId,
    transaction_id: tx?.id || null,
    notes,
  })

  if (salError) {
    return { error: salError.message || 'Could not record salary disbursement.' }
  }

  // 3. Deduct from account balance if account selected
  if (accountId) {
    const { data: acc } = await supabase.from('accounts').select('opening_balance').eq('id', accountId).single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ opening_balance: Number(acc.opening_balance || 0) - netAmount })
        .eq('id', accountId)
    }
  }

  // 4. Audit Log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: 'paid',
    entity_type: 'salary',
    summary: `Disbursed ${paymentMonth} salary of ${netAmount} to ${empName}`,
  })

  revalidatePath('/dashboard/employees')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}
