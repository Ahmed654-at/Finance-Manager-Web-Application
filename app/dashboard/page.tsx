import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationBell from './notifications/NotificationBell'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  // Get the user's company via company_members
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const companyId = membership.company_id

  const { data: notificationsResult } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const notifications = notificationsResult ?? []

  // Fetch ALL transactions for this company (for accurate totals),
  // joined with category name
  const { data: allTransactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .order('transaction_date', { ascending: false })

  const allData = allTransactions ?? []
  const recentTransactions = allData.slice(0, 10)

  const totalIncome = allData.reduce((sum, t) => {
    return t.type === 'income' ? sum + Number(t.amount || 0) : sum
  }, 0)

  const totalExpenses = allData.reduce((sum, t) => {
    return t.type === 'expense' ? sum + Number(t.amount || 0) : sum
  }, 0)

  const netBalance = totalIncome - totalExpenses

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xl font-semibold text-slate-900">Finance Manager</p>
          <div className="flex items-center gap-4">
            <NotificationBell initialNotifications={notifications} />
            <span className="text-sm text-slate-600">{user.email}</span>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Logout
              </button>
            </form>
          </div>
        </nav>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Income</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-600">
              {currencyFormatter.format(totalIncome)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Expenses</p>
            <p className="mt-3 text-3xl font-semibold text-red-600">
              {currencyFormatter.format(totalExpenses)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Net Balance</p>
            <p className={`mt-3 text-3xl font-semibold ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {currencyFormatter.format(netBalance)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Recent Transactions</h2>
            <div className="flex items-center gap-2">
              <a
                href="/dashboard/transactions/new"
                className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                + Add Transaction
              </a>
              <a
                href="/dashboard/categories"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Manage Categories
              </a>
              <a
                href="/dashboard/budgets"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Budgets
              </a>
              <a
                href="/dashboard/customers"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Customers
              </a>
              <a
                href="/dashboard/invoices"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Invoices
              </a>
              <a
                href="/dashboard/accounts"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Accounts
              </a>
              <a
                href="/dashboard/team"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Team
              </a>
              <a
                href="/dashboard/settings"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Settings
              </a>
              <a
                href="/dashboard/audit"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Activity Log
              </a>
              <a
                href="/dashboard/reports"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Reports
              </a>
            </div>
          </div>

          {transactionsError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              There was an error loading your transactions.
            </p>
          ) : recentTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No transactions yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Add your first income or expense to start tracking your cash flow.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Description</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => {
                    const amount = Number(t.amount || 0)
                    const isIncome = t.type === 'income'
                    const categoryName = t.categories?.name || 'Uncategorized'

                    return (
                      <tr key={t.id} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                        <td className="py-3 pr-4">{t.transaction_date || '—'}</td>
                        <td className="py-3 pr-4">{categoryName}</td>
                        <td className="py-3 pr-4">{t.description || '—'}</td>
                        <td className={`py-3 pr-4 font-medium ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'}{currencyFormatter.format(Math.abs(amount))}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                              isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Link
              href="/dashboard/transactions"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              View all transactions →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}