import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteEmployee, disburseSalary } from './actions'
import DeleteConfirmButton from '../components/DeleteConfirmButton'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  const canManage = role === 'owner' || role === 'admin'

  // Fetch employees
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  const employees = employeesData ?? []

  // Fetch recent salary disbursements
  const { data: salariesData } = await supabase
    .from('salaries')
    .select('*, employees(name, designation, department), accounts(name)')
    .eq('company_id', companyId)
    .order('payment_date', { ascending: false })
    .limit(20)

  const salaries = salariesData ?? []

  // Fetch bank/cash accounts for payroll disbursement
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  const accounts = accountsData ?? []

  // Which employees also have a login here (matched by email), and with what role.
  const loginRoleByEmail = new Map<string, string>()
  if (canManage && supabaseAdmin) {
    const { data: memberRows } = await supabase
      .from('company_members')
      .select('user_id, role')
      .eq('company_id', companyId)

    const roleByUserId = new Map((memberRows ?? []).map((m) => [m.user_id, m.role as string]))
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })

    for (const authUser of usersData?.users ?? []) {
      const memberRole = roleByUserId.get(authUser.id)
      if (memberRole && authUser.email) {
        loginRoleByEmail.set(authUser.email.toLowerCase(), memberRole)
      }
    }
  }

  const activeEmployees = employees.filter((e) => e.status === 'active')
  const totalMonthlyPayroll = activeEmployees.reduce((sum, e) => sum + Number(e.salary_amount || 0), 0)
  const totalSalariesPaid = salaries.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)

  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                ← Dashboard
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-700">Team</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Employees & Payroll
            </h1>
            <p className="text-sm text-slate-500">
              Track staff, compensation, and disburse monthly salaries for {company.name}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Staff</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{activeEmployees.length}</p>
            <p className="mt-1 text-xs text-slate-500">{employees.length} total registered</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Commitment</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatCurrency(totalMonthlyPayroll, company.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Based on active base salaries</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent Disbursements</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {formatCurrency(totalSalariesPaid, company.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{salaries.length} salary runs recorded</p>
          </div>
        </div>

        {/* Quick Forms Grid */}
        {canManage && (
          <div className="grid gap-6">
            {/* Disburse Salary Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Disburse Salary / Run Payroll</h2>
              <p className="mt-1 text-xs text-slate-500">Record a salary payout and auto-sync with transactions</p>

              {activeEmployees.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Add an employee on the Team page first to enable salary disbursements.
                </div>
              ) : (
                <form action={async (formData) => { 'use server'; await disburseSalary(formData) }} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Select Employee *</label>
                    <select
                      name="employee_id"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} — {emp.designation} ({formatCurrency(emp.salary_amount, company.currency)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Payment Month *</label>
                      <input
                        name="payment_month"
                        type="text"
                        defaultValue={currentMonthName}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Payment Date *</label>
                      <input
                        name="payment_date"
                        type="date"
                        defaultValue={today}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Base Amount *</label>
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        placeholder="Amount"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Bonus</label>
                      <input
                        name="bonus"
                        type="number"
                        step="0.01"
                        defaultValue="0"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Deductions</label>
                      <input
                        name="deductions"
                        type="number"
                        step="0.01"
                        defaultValue="0"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Paid from Account</label>
                      <select
                        name="account_id"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      >
                        <option value="">None / External</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.opening_balance, company.currency)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Notes / Pay Slip Ref</label>
                      <input
                        name="notes"
                        type="text"
                        placeholder="e.g. Regular monthly payroll"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
                  >
                    Confirm & Record Salary Disbursement
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Employees Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Employees Directory</h2>
          <p className="text-xs text-slate-500">Current team members and compensation packages</p>

          {employees.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No employees yet. Add people, with their email and payroll details, from the{' '}
              <Link href="/dashboard/team" className="font-medium text-slate-700 underline">
                Team page
              </Link>
              .
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Employee</th>
                    <th className="pb-3 pr-4">Designation</th>
                    <th className="pb-3 pr-4">Department</th>
                    <th className="pb-3 pr-4">Base Salary</th>
                    <th className="pb-3 pr-4">Payment Method</th>
                    <th className="pb-3 pr-4">Status</th>
                    {canManage && <th className="pb-3">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{emp.name}</p>
                        {emp.email && <p className="text-xs text-slate-500">{emp.email}</p>}
                        {canManage &&
                          (() => {
                            const loginRole = emp.email ? loginRoleByEmail.get(String(emp.email).toLowerCase()) : undefined
                            return loginRole ? (
                              <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium capitalize text-blue-700">
                                Has login · {loginRole}
                              </span>
                            ) : (
                              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                No login
                              </span>
                            )
                          })()}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{emp.designation}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {emp.department}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {formatCurrency(emp.salary_amount, company.currency)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600 capitalize">
                        {emp.payment_method.replace('_', ' ')}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            emp.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3">
                          <DeleteConfirmButton
                            label="Delete"
                            confirmText="Delete this employee?"
                            action={async () => {
                              'use server'
                              await deleteEmployee(emp.id)
                            }}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Salary History Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Salary Disbursements & Payroll History</h2>
          <p className="text-xs text-slate-500">Record of executed salary payments and vouchers</p>

          {salaries.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No salary disbursements recorded yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Payment Date</th>
                    <th className="pb-3 pr-4">Month</th>
                    <th className="pb-3 pr-4">Employee</th>
                    <th className="pb-3 pr-4">Base</th>
                    <th className="pb-3 pr-4">Bonus / Ded.</th>
                    <th className="pb-3 pr-4">Net Paid</th>
                    <th className="pb-3 pr-4">Account</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaries.map((sal) => (
                    <tr key={sal.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 text-slate-600">{sal.payment_date}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{sal.payment_month}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{sal.employees?.name || '—'}</p>
                        <p className="text-xs text-slate-500">{sal.employees?.designation}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {formatCurrency(sal.amount, company.currency)}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span className="text-emerald-600">+{sal.bonus}</span> /{' '}
                        <span className="text-red-500">-{sal.deductions}</span>
                      </td>
                      <td className="py-3 pr-4 font-bold text-emerald-700">
                        {formatCurrency(sal.net_amount, company.currency)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {sal.accounts?.name || 'External'}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 uppercase">
                          {sal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
