import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import {
  approveExpense,
  createTeamExpense,
  deleteTeamExpense,
  markExpenseReimbursed,
  rejectExpense,
} from './actions'
import DeleteConfirmButton from '../components/DeleteConfirmButton'

export default async function TeamExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }> | { status?: string }
}) {
  const params = (await Promise.resolve(searchParams ?? {})) as { status?: string }
  const statusFilter = params.status || 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  const canManage = role === 'owner' || role === 'admin' || role === 'accountant'
  const canReview = role === 'owner' || role === 'admin'

  // Fetch categories (focusing on expenses)
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', 'expense')
    .order('name')

  const categories = categoriesData ?? []

  // Fetch accounts
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  const accounts = accountsData ?? []

  // Query team expenses
  let query = supabase
    .from('team_expenses')
    .select('*, categories(name), accounts(name)')
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: expensesData } = await query
  const expenses = expensesData ?? []

  // Compute metrics
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const pendingAmount = expenses
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const reimbursedAmount = expenses
    .filter((e) => e.status === 'reimbursed')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                ← Dashboard
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-700">Expenses</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Team Expenses & Claims
            </h1>
            <p className="text-sm text-slate-500">
              Track team operational spending, GPU/API credits, and staff reimbursements for {company.name}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Claims Tracked</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatCurrency(totalAmount, company.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{expenses.length} expense items</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Pending Reimbursement</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {formatCurrency(pendingAmount, company.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Awaiting payout confirmation</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Reimbursed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {formatCurrency(reimbursedAmount, company.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Synced to ledger transactions</p>
          </div>
        </div>

        {/* Add Team Expense Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Record Team Expense or Reimbursement</h2>
          <p className="mt-1 text-xs text-slate-500">
            Submit a team member claim (e.g. OpenAI API tokens, Cloud GPUs, Client meetings, Software licenses)
          </p>

          <form action={async (formData) => { 'use server'; await createTeamExpense(formData) }} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Team Member Name *</label>
                <input
                  name="submitted_by_name"
                  type="text"
                  required
                  placeholder="e.g. Hamza / Sarah"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Expense Title / Description *</label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. RunPod GPU Cluster / OpenAI Usage"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Amount ({company.currency}) *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 150.00"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Expense Date</label>
                <input
                  name="expense_date"
                  type="date"
                  defaultValue={today}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Category</label>
                <select
                  name="category_id"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Status</label>
                <select
                  name="status"
                  defaultValue="approved"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Review</option>
                  <option value="reimbursed">Reimbursed & Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Paid from Account (if reimbursed)</label>
                <select
                  name="account_id"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">None / External</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Receipt / Proof Link</label>
                <input
                  name="receipt_url"
                  type="url"
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes / Remarks</label>
                <input
                  name="notes"
                  type="text"
                  placeholder="e.g. Approved by Lead Engineer"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Submit Team Expense
            </button>
          </form>
        </div>

        {/* Expenses List & Filter */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Expense Claims & Records</h2>
              <p className="text-xs text-slate-500">History of team expenses and their reimbursement state</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {['all', 'pending', 'approved', 'reimbursed', 'rejected'].map((st) => (
                <Link
                  key={st}
                  href={`/dashboard/team-expenses?status=${st}`}
                  className={`rounded-lg border px-3 py-1.5 font-medium capitalize transition ${
                    statusFilter === st
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </Link>
              ))}
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No team expenses found under filter &quot;{statusFilter}&quot;.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Team Member</th>
                    <th className="pb-3 pr-4">Expense Item</th>
                    <th className="pb-3 pr-4">Category / Purpose</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Status</th>
                    {canManage && <th className="pb-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 text-slate-600">{exp.expense_date}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{exp.submitted_by_name}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{exp.title}</p>
                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Receipt ↗
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {exp.categories?.name || 'General Expense'}
                        {exp.purpose && (
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium capitalize text-slate-700">
                            {exp.purpose}
                          </span>
                        )}
                        {exp.notes && <p className="mt-1 max-w-xs text-slate-500">{exp.notes}</p>}
                        {exp.review_note && (
                          <p className="mt-1 max-w-xs italic text-slate-500">Review: {exp.review_note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {formatCurrency(exp.amount, company.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            exp.status === 'reimbursed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : exp.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canReview && exp.status === 'pending' && (
                              <>
                                <form
                                  action={async () => {
                                    'use server'
                                    await approveExpense(exp.id)
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    Approve
                                  </button>
                                </form>
                                <form
                                  action={async (formData: FormData) => {
                                    'use server'
                                    await rejectExpense(exp.id, String(formData.get('note') ?? ''))
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <input
                                    name="note"
                                    placeholder="Reason (optional)"
                                    className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                                  >
                                    Reject
                                  </button>
                                </form>
                              </>
                            )}

                            {exp.status === 'approved' && (
                              <form
                                action={async () => {
                                  'use server'
                                  await markExpenseReimbursed(exp.id)
                                }}
                              >
                                <button
                                  type="submit"
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                                >
                                  Reimburse
                                </button>
                              </form>
                            )}

                            <DeleteConfirmButton
                              label="Delete"
                              confirmText="Delete this expense claim?"
                              action={async () => {
                                'use server'
                                await deleteTeamExpense(exp.id)
                              }}
                            />
                          </div>
                        </td>
                      )}
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
