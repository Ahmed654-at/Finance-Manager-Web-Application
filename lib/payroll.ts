import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type PayrollMatch = {
  id: string
  name: string
  email: string | null
  salary_amount: number
}

/** Escape % _ \ so a value can be used with ILIKE as an exact, case-insensitive match. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * Finds the payroll record (Employees page) that belongs to a login.
 * Matches by the login's email first, and falls back to the name only when the email finds nothing.
 * `db` is the client used to read `employees`.
 */
export async function findPayrollEmployee(
  db: SupabaseClient,
  companyId: string,
  userId: string | null,
  name: string,
): Promise<PayrollMatch | null> {
  const columns = 'id, name, email, salary_amount'

  if (userId && supabaseAdmin) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = data?.user?.email?.toLowerCase()

    if (email) {
      const { data: byEmail } = await db
        .from('employees')
        .select(columns)
        .eq('company_id', companyId)
        .ilike('email', escapeLike(email))
        .limit(1)
        .maybeSingle()

      if (byEmail) return byEmail as PayrollMatch
    }
  }

  if (!name.trim()) return null

  const { data: byName } = await db
    .from('employees')
    .select(columns)
    .eq('company_id', companyId)
    .ilike('name', escapeLike(name.trim()))
    .limit(1)
    .maybeSingle()

  return (byName as PayrollMatch | null) ?? null
}

/** Payroll fields that the Team "add account" form can capture. */
export type PayrollDetails = {
  designation: string
  department: string
  salaryAmount: number
  paymentMethod: string
  bankAccountDetails: string | null
}

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'cheque', 'crypto']

export function readPayrollDetails(formData: FormData): PayrollDetails | null {
  const designation = String(formData.get('designation') ?? '').trim()
  const department = String(formData.get('department') ?? '').trim()
  const salaryRaw = String(formData.get('salary_amount') ?? '').trim()
  const bank = String(formData.get('bank_account_details') ?? '').trim()
  const method = String(formData.get('payment_method') ?? '').trim()

  // Nothing filled in: the person is added with a login only.
  if (!designation && !department && !salaryRaw && !bank) return null

  const salaryAmount = salaryRaw ? Number(salaryRaw) : 0

  return {
    designation,
    department: department || 'AI Services',
    salaryAmount: Number.isFinite(salaryAmount) && salaryAmount >= 0 ? Math.round(salaryAmount * 100) / 100 : 0,
    paymentMethod: PAYMENT_METHODS.includes(method) ? method : 'bank_transfer',
    bankAccountDetails: bank || null,
  }
}

/** Creates the payroll record for an email, or updates it if one with that email already exists. */
export async function upsertPayrollRecord(
  db: SupabaseClient,
  companyId: string,
  email: string,
  fallbackName: string,
  details: PayrollDetails,
  roleLabel: string,
): Promise<{ error?: string }> {
  const { data: existing } = await db
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .ilike('email', escapeLike(email))
    .limit(1)
    .maybeSingle()

  const designation = details.designation || roleLabel

  if (existing) {
    const { error } = await db
      .from('employees')
      .update({
        designation,
        department: details.department,
        salary_amount: details.salaryAmount,
        payment_method: details.paymentMethod,
        bank_account_details: details.bankAccountDetails,
      })
      .eq('id', existing.id)
      .eq('company_id', companyId)

    return error ? { error: error.message } : {}
  }

  const { error } = await db.from('employees').insert({
    company_id: companyId,
    name: fallbackName,
    email,
    designation,
    department: details.department,
    salary_amount: details.salaryAmount,
    status: 'active',
    payment_method: details.paymentMethod,
    bank_account_details: details.bankAccountDetails,
  })

  return error ? { error: error.message } : {}
}
