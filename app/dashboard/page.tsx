import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { getAccountName } from '@/lib/user'
import DashboardNav from './components/DashboardNav'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  // Get or auto-initialize single company context
  const { companyId, company } = await getCompanyContext(supabase, user)
  const accountName = await getAccountName(supabase, user)

  // 1. Fetch Transactions
  const { data: allTransactions } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .order('transaction_date', { ascending: false })

  const allData = allTransactions ?? []
  const recentTransactions = allData.slice(0, 8)

  const totalIncome = allData.reduce((sum, t) => (t.type === 'income' ? sum + Number(t.amount || 0) : sum), 0)
  const totalExpenses = allData.reduce((sum, t) => (t.type === 'expense' ? sum + Number(t.amount || 0) : sum), 0)
  const netBalance = totalIncome - totalExpenses

  // Income Stream Breakdown
  const aiIncome = allData
    .filter((t) => t.type === 'income' && (t.revenue_stream === 'ai_services' || t.categories?.name?.toLowerCase().includes('ai')))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const productIncome = allData
    .filter((t) => t.type === 'income' && (t.revenue_stream === 'product_sales' || t.categories?.name?.toLowerCase().includes('product')))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const otherIncome = Math.max(0, totalIncome - aiIncome - productIncome)

  // Expense Stream Breakdown
  const salaryExpenses = allData
    .filter((t) => t.type === 'expense' && (t.expense_type === 'salary' || t.categories?.name?.toLowerCase().includes('salary')))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const teamExpensesTotal = allData
    .filter((t) => t.type === 'expense' && (t.expense_type === 'team_expense' || t.categories?.name?.toLowerCase().includes('team')))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const infraExpenses = allData
    .filter((t) => t.type === 'expense' && (t.expense_type === 'infrastructure' || t.categories?.name?.toLowerCase().includes('infrastructure') || t.categories?.name?.toLowerCase().includes('cloud')))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  // 2. Fetch Invoices
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('*, customers(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  const invoices = invoicesData ?? []
  const recentInvoices = invoices.slice(0, 5)
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  const pendingInvoicesTotal = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0)

  // 3. Fetch Employees & Salaries count
  const { data: employeesData } = await supabase
    .from('employees')
    .select('id, name, salary_amount, status')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const activeEmployees = employeesData ?? []
  const monthlySalaryCommitment = activeEmployees.reduce((sum, e) => sum + Number(e.salary_amount || 0), 0)

  // 4. Fetch Team Expenses pending
  const { data: pendingClaimsData } = await supabase
    .from('team_expenses')
    .select('id, amount')
    .eq('company_id', companyId)
    .eq('status', 'pending')

  const pendingClaimsCount = pendingClaimsData?.length ?? 0
  const pendingClaimsAmount = (pendingClaimsData ?? []).reduce((sum, c) => sum + Number(c.amount || 0), 0)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Navigation Bar */}
        <DashboardNav companyName={company.name} userEmail={user.email} accountName={accountName} />

        {/* Overview Header & Primary Action */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Financial Overview</h1>
            <p className="text-xs text-slate-500">Real-time performance and cash flow metrics for {company.name}</p>
          </div>
          <Link
            href="/dashboard/transactions/new"
            className="inline-flex items-center gap-1.5 self-start rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:self-auto"
          >
            <span>+</span> Record Transaction
          </Link>
        </div>

        {/* Primary KPI Grid Tailored for AI & Product Company */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Income & Revenue Streams */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 sm:text-3xl">
              {formatCurrency(totalIncome, company.currency)}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium text-slate-700">AI Services:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(aiIncome, company.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium text-slate-700">Product Sales:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(productIncome, company.currency)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Expenses & Payroll/Team Split */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Expenses</p>
            <p className="mt-2 text-2xl font-bold text-red-600 sm:text-3xl">
              {formatCurrency(totalExpenses, company.currency)}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium text-slate-700">Salaries:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(salaryExpenses, company.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium text-slate-700">Team Claims:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(teamExpensesTotal, company.currency)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit / Loss</p>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(netBalance, company.currency)}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Profit Margin:</span>
                <span className="font-semibold text-slate-900">
                  {totalIncome > 0 ? `${Math.round((netBalance / totalIncome) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Monthly Staff Payroll:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(monthlySalaryCommitment, company.currency)}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Invoices & Receivables */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invoices & Receivables</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {formatCurrency(totalInvoiced, company.currency)}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-amber-600 font-medium">Pending Invoices:</span>
                <span className="font-semibold text-amber-700">{formatCurrency(pendingInvoicesTotal, company.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Pending Team Claims:</span>
                <span className="font-semibold text-slate-900">{pendingClaimsCount} ({formatCurrency(pendingClaimsAmount, company.currency)})</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Financial Transactions Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
              <p className="text-xs text-slate-500">Double-entry revenue and expense activity</p>
            </div>
            <Link
              href="/dashboard/transactions"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              View all transactions →
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No transactions recorded yet. Use &quot;Add Transaction&quot; above to log income or expenses.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Classification</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((t) => {
                    const amount = Number(t.amount || 0)
                    const isIncome = t.type === 'income'

                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 text-slate-500">{t.transaction_date || '—'}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900">{t.description || '—'}</td>
                        <td className="py-3 pr-4 text-xs text-slate-600">{t.categories?.name || 'General'}</td>
                        <td className="py-3 pr-4 text-xs text-slate-600">
                          {t.revenue_stream === 'ai_services' && 'AI Service'}
                          {t.revenue_stream === 'product_sales' && 'Product Sale'}
                          {t.expense_type === 'salary' && 'Salary'}
                          {t.expense_type === 'team_expense' && 'Team Claim'}
                          {t.expense_type === 'infrastructure' && 'GPU / API'}
                          {!t.revenue_stream && !t.expense_type && (t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : '—')}
                        </td>
                        <td className={`py-3 text-right font-bold ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(amount), company.currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Invoices & Team Overview Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Invoices */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Invoices</h2>
                <p className="text-xs text-slate-500">Client billing and receivables status</p>
              </div>
              <Link href="/dashboard/invoices" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                View all →
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                No invoices created yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-500">{inv.customers?.name || 'Unknown Client'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(inv.total, company.currency)}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Management Links */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Company Operations</h2>
            <p className="text-xs text-slate-500">Quick access to all company management tools</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Link
                href="/dashboard/employees"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Employees & Payroll</span>
                <span className="text-slate-500">{activeEmployees.length} Active Staff</span>
              </Link>

              <Link
                href="/dashboard/team-expenses"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Team Expenses</span>
                <span className="text-slate-500">{pendingClaimsCount} Claims Pending</span>
              </Link>

              <Link
                href="/dashboard/services"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">AI & Products</span>
                <span className="text-slate-500">Manage Offerings</span>
              </Link>

              <Link
                href="/dashboard/accounts"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Accounts & Wallets</span>
                <span className="text-slate-500">Cash & Bank Balances</span>
              </Link>

              <Link
                href="/dashboard/customers"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Customers & Clients</span>
                <span className="text-slate-500">Directory</span>
              </Link>

              <Link
                href="/dashboard/budgets"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Budgets & Limits</span>
                <span className="text-slate-500">Spending Thresholds</span>
              </Link>

              <Link
                href="/dashboard/reports"
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">Reports & Analytics</span>
                <span className="text-slate-500">P&L and Cash Flow</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}