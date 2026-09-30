import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { getAccountName } from '@/lib/user'
import { submitMyExpense, submitMySalary } from './actions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  reimbursed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

export default async function MyExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
}) {
  const params = (await searchParams) ?? {}

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { company, role } = await getCompanyContext(supabase, user)

  // Staff use the full dashboard; this page is the employee workspace.
  if (role !== 'employee') redirect('/dashboard/team-expenses')

  const accountName = await getAccountName(supabase, user)

  // RLS limits this to the employee's own requests.
  const { data: rows } = await supabase
    .from('team_expenses')
    .select('*')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  const { data: salaryRows } = await supabase
    .from('salary_requests')
    .select('*')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  const salaries = salaryRows ?? []
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const expenses = rows ?? []
  const today = new Date().toISOString().slice(0, 10)
  const sum = (status: string) =>
    expenses.filter((e) => e.status === status).reduce((total, e) => total + Number(e.amount || 0), 0)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{company.name}</h1>
            <p className="text-xs text-slate-500">
              {accountName} · {user.email} · Employee
            </p>
          </div>
          <Link
            href="/account/password"
            className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
          >
            Change password
          </Link>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </header>

        {params.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{params.error}</p>
        )}
        {params.success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {params.success}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Awaiting approval</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{formatCurrency(sum('pending'), company.currency)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Approved</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(sum('approved'), company.currency)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Reimbursed</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(sum('reimbursed'), company.currency)}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Request an expense</h2>
          <p className="mt-1 text-xs text-slate-500">
            Your owner or admin will review it. You can only see your own requests.
          </p>

          <form action={submitMyExpense} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">What is it for? *</label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Facebook ads for launch / API credits"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Amount ({company.currency}) *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Date</label>
                <input
                  name="expense_date"
                  type="date"
                  defaultValue={today}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Purpose *</label>
                <select
                  name="purpose"
                  required
                  defaultValue=""
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  <option value="project">Project</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Receipt link</label>
                <input
                  name="receipt_url"
                  type="url"
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Notes (project name, details)</label>
              <input
                name="notes"
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Send for approval
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Request salary</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ask for your salary for a month. Your owner or admin will approve it and pay it.
          </p>

          <form action={submitMySalary} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Salary month *</label>
                <input
                  name="payment_month"
                  type="text"
                  required
                  defaultValue={currentMonth}
                  placeholder="e.g. October 2026"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Amount ({company.currency}) *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <input
                  name="notes"
                  type="text"
                  placeholder="e.g. includes overtime"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              Send salary request
            </button>
          </form>

          {salaries.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">My salary requests</h3>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Month</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaries.map((sal) => (
                    <tr key={sal.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{sal.payment_month}</p>
                        {sal.review_note && (
                          <p className="text-xs italic text-slate-500">Reviewer: {sal.review_note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {formatCurrency(sal.amount, company.currency)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            sal.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : STATUS_STYLES[sal.status] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {sal.status === 'approved' ? 'approved & paid' : sal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My requests</h2>

          {expenses.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              You haven&apos;t submitted any requests yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Item</th>
                    <th className="pb-3 pr-4">Purpose</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-3 pr-4 text-slate-600">{exp.expense_date}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{exp.title}</p>
                        {exp.review_note && (
                          <p className="text-xs italic text-slate-500">Reviewer: {exp.review_note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs capitalize text-slate-600">{exp.purpose ?? '—'}</td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {formatCurrency(exp.amount, company.currency)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[exp.status] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {exp.status}
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
