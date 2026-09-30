import Link from 'next/link'
import { redirect } from 'next/navigation'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, ensureDefaultCategories } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { deleteBudget } from './actions'
import BudgetCreateForm from './BudgetCreateForm'

export default async function BudgetsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, company } = await getCompanyContext(supabase, user)

  // Ensure standard company expense categories (Marketing, Employees Salaries, Team Travelling, Team Lunch, etc.) exist
  await ensureDefaultCategories(supabase, companyId)

  const { data: expenseCategoriesResult } = await supabase
    .from('categories')
    .select('id, company_id, name, type, description')
    .eq('company_id', companyId)
    .eq('type', 'expense')
    .order('name')

  const expenseCategories = Array.isArray(expenseCategoriesResult)
    ? expenseCategoriesResult.filter((category) => String(category.type).toLowerCase() === 'expense')
    : []

  const { data: budgetsResult } = await supabase
    .from('budgets')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .order('start_date', { ascending: false })

  const budgets = budgetsResult ?? []

  const budgetsWithSpend = await Promise.all(
    budgets.map(async (budget) => {
      const startDate = budget.start_date
      const endDate = budget.end_date

      const { data: spendRows } = await supabase
        .from('transactions')
        .select('amount')
        .eq('company_id', companyId)
        .eq('category_id', budget.category_id)
        .eq('type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)

      const actualSpend = (spendRows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)

      return {
        ...budget,
        actualSpend,
      }
    })
  )

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Budgets & Expense Limits</h1>
              <p className="mt-1 text-sm text-slate-500">
                Track limits for Marketing, Employees Salaries, Team Travelling, Team Lunch, and operations.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <BudgetCreateForm categories={expenseCategories} currency={company.currency} />

          {budgetsWithSpend.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No budgets yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Create your first budget to track expense limits for your company.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {budgetsWithSpend.map((budget) => {
                const budgetAmount = Number(budget.amount || 0)
                const actualSpend = Number(budget.actualSpend || 0)
                const progress = Math.min((actualSpend / (budgetAmount || 1)) * 100, 100)

                let barClasses = 'bg-emerald-500'
                let labelClasses = 'text-emerald-700'

                if (actualSpend >= budgetAmount && budgetAmount > 0) {
                  barClasses = 'bg-red-500'
                  labelClasses = 'text-red-700'
                } else if (progress >= 80) {
                  barClasses = 'bg-amber-500'
                  labelClasses = 'text-amber-700'
                }

                const catName = budget.categories?.name || 'Uncategorized'
                let catBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
                if (catName.toLowerCase().includes('marketing')) {
                  catBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200'
                } else if (catName.toLowerCase().includes('salar')) {
                  catBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                } else if (catName.toLowerCase().includes('travell') || catName.toLowerCase().includes('travel')) {
                  catBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200'
                } else if (catName.toLowerCase().includes('lunch') || catName.toLowerCase().includes('meal')) {
                  catBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200'
                }

                return (
                  <div
                    key={budget.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{budget.name}</h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${catBadgeClass}`}>
                            🏷️ {catName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/budgets/${budget.id}/edit`}
                          className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                        >
                          Edit
                        </Link>
                        <DeleteConfirmButton
                          action={deleteBudget.bind(null, budget.id)}
                          label="Delete"
                          confirmText="Delete this budget?"
                          className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                        />
                      </div>
                    </div>

                    <div className="mb-2 text-sm text-slate-600">
                      {budget.start_date} → {budget.end_date}
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${barClasses}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-3 text-sm text-slate-700">
                      <span className={`font-medium ${labelClasses}`}>
                        {formatCurrency(actualSpend, company.currency)}
                      </span>
                      {' spent of '}
                      <span className="font-medium text-slate-900">{formatCurrency(budgetAmount, company.currency)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
