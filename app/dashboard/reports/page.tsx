import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)

function getMonthBounds(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const defaultRange = getMonthBounds()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

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

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: false })

  const items = transactions ?? []

  const pnlMap = new Map<string, { income: number; expense: number }>()
  const categoryRows: { name: string; type: 'income' | 'expense'; total: number }[] = []

  items.forEach((transaction) => {
    const categoryName = transaction.categories?.name || 'Uncategorized'
    const amount = Number(transaction.amount || 0)
    const type = transaction.type === 'income' ? 'income' : 'expense'

    const entry = pnlMap.get(categoryName) ?? { income: 0, expense: 0 }

    if (type === 'income') {
      entry.income += amount
    } else {
      entry.expense += amount
    }

    pnlMap.set(categoryName, entry)
  })

  Array.from(pnlMap.entries()).forEach(([name, totals]) => {
    if (totals.income > 0) {
      categoryRows.push({ name, type: 'income', total: totals.income })
    }
    if (totals.expense > 0) {
      categoryRows.push({ name, type: 'expense', total: totals.expense })
    }
  })

  const incomeCategories = categoryRows.filter((row) => row.type === 'income').sort((a, b) => b.total - a.total)
  const expenseCategories = categoryRows.filter((row) => row.type === 'expense').sort((a, b) => b.total - a.total)

  const totalIncome = items
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const totalExpenses = items
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const netProfit = totalIncome - totalExpenses

  const dayDiff = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
  const useMonthlyBuckets = dayDiff > 31

  const cashFlowMap = new Map<string, { income: number; expense: number }>()

  items.forEach((transaction) => {
    const date = new Date(`${transaction.transaction_date}T00:00:00`)
    let key = formatDateInput(date)

    if (useMonthlyBuckets) {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    const entry = cashFlowMap.get(key) ?? { income: 0, expense: 0 }

    if (transaction.type === 'income') {
      entry.income += Number(transaction.amount || 0)
    } else {
      entry.expense += Number(transaction.amount || 0)
    }

    cashFlowMap.set(key, entry)
  })

  const cashFlowRows = Array.from(cashFlowMap.entries()).map(([period, totals]) => ({
    period,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
  }))

  cashFlowRows.sort((a, b) => a.period.localeCompare(b.period))

  const hasTransactions = items.length > 0
  const pnlQuery = new URLSearchParams({ from, to, type: 'pnl' })
  const cashflowQuery = new URLSearchParams({ from, to, type: 'cashflow' })

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <form method="GET" className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="to" className="block text-sm font-medium text-slate-700">
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Filter
            </button>
          </form>

          {hasTransactions ? (
            <>
              <div className="mb-8 flex flex-wrap gap-3">
                <a
                  href={`/dashboard/reports/export?${pnlQuery.toString()}`}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Export P&L as CSV
                </a>
                <a
                  href={`/dashboard/reports/export?${cashflowQuery.toString()}`}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Export Cash Flow as CSV
                </a>
              </div>

              <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">Profit & Loss</h2>
                  <p className={`text-2xl font-semibold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {netProfit >= 0 ? 'Net Profit' : 'Net Loss'}: {currencyFormatter.format(Math.abs(netProfit))}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-700">Income by category</p>
                    </div>
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-sm text-slate-500">
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">
                              No income in this range.
                            </td>
                          </tr>
                        ) : (
                          incomeCategories.map((row) => (
                            <tr key={row.name} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                              <td className="px-4 py-3">{row.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-emerald-600">
                                {currencyFormatter.format(row.total)}
                              </td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-slate-50 text-sm font-semibold text-slate-900">
                          <td className="px-4 py-3">Total income</td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {currencyFormatter.format(totalIncome)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-semibold text-red-700">Expenses by category</p>
                    </div>
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-sm text-slate-500">
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">
                              No expenses in this range.
                            </td>
                          </tr>
                        ) : (
                          expenseCategories.map((row) => (
                            <tr key={row.name} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                              <td className="px-4 py-3">{row.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-red-600">
                                {currencyFormatter.format(row.total)}
                              </td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-slate-50 text-sm font-semibold text-slate-900">
                          <td className="px-4 py-3">Total expenses</td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {currencyFormatter.format(totalExpenses)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Cash Flow</h2>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-sm text-slate-500">
                        <th className="px-4 py-3 font-medium">Period</th>
                        <th className="px-4 py-3 font-medium text-right">Income</th>
                        <th className="px-4 py-3 font-medium text-right">Expenses</th>
                        <th className="px-4 py-3 font-medium text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashFlowRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                            No cash flow data in this range.
                          </td>
                        </tr>
                      ) : (
                        cashFlowRows.map((row) => (
                          <tr key={row.period} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                            <td className="px-4 py-3">{row.period}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                              {currencyFormatter.format(row.income)}
                            </td>
                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                              {currencyFormatter.format(row.expense)}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${row.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {currencyFormatter.format(row.net)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No transactions in this range</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different date range to see your profit and cash flow breakdown.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
