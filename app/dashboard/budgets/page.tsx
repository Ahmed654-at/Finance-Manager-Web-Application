import Link from 'next/link'
import { redirect } from 'next/navigation'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import { createBudget, deleteBudget } from './actions'

async function handleCreateBudget(formData: FormData) {
  'use server'
  await createBudget(formData)
}

export default async function BudgetsPage() {
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
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Budgets</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <form
            action={handleCreateBudget}
            className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Budget name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Marketing budget"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                {expenseCategories.length === 0 ? (
                  <option value="" disabled>
                    No expense categories available
                  </option>
                ) : (
                  <>
                    <option value="" disabled>
                      Select an expense category
                    </option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
                  Amount
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-slate-700">
                  Start date
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-slate-700">
                End date
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add budget
            </button>
          </form>

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

                return (
                  <div
                    key={budget.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{budget.name}</h3>
                        <p className="text-sm text-slate-600">{budget.categories?.name || 'Uncategorized'}</p>
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
                        ${actualSpend.toFixed(2)}
                      </span>
                      {' spent of '}
                      <span className="font-medium text-slate-900">${budgetAmount.toFixed(2)}</span>
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
