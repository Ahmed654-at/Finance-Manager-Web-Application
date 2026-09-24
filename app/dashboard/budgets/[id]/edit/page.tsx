'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeleteConfirmButton from '../../../components/DeleteConfirmButton'
import { deleteBudget, updateBudget } from '../../actions'

type ExpenseCategory = {
  id: string
  name: string
}

type BudgetRecord = {
  id: string
  name: string
  category_id: string | null
  amount: number | string | null
  start_date: string | null
  end_date: string | null
}

export default function EditBudgetPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [budget, setBudget] = useState<BudgetRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!user || userError) {
        router.push('/login')
        return
      }

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership) {
        router.push('/onboarding')
        return
      }

      const [{ data: categoriesData }, { data: budgetData }] = await Promise.all([
        supabase.from('categories').select('id, name').eq('company_id', membership.company_id).eq('type', 'expense').order('name'),
        supabase
          .from('budgets')
          .select('*')
          .eq('id', id)
          .eq('company_id', membership.company_id)
          .limit(1)
          .maybeSingle(),
      ])

      if (!budgetData) {
        router.push('/dashboard/budgets')
        return
      }

      setCategories((categoriesData ?? []) as ExpenseCategory[])
      setBudget(budgetData as BudgetRecord)
      setLoading(false)
    }

    void fetchData()
  }, [id, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!id) return

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await updateBudget(id, formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      router.push('/dashboard/budgets')
    })
  }

  if (loading || !budget) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Budgets</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit budget</h1>
            </div>
            <Link
              href="/dashboard/budgets"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to budgets
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Budget name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={budget.name}
                required
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
                defaultValue={budget.category_id ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="" disabled>
                  Select an expense category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={Number(budget.amount ?? 0)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-slate-700">
                  Start date
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={budget.start_date ?? ''}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-slate-700">
                  End date
                </label>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  defaultValue={budget.end_date ?? ''}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving...' : 'Save budget'}
            </button>
          </form>

          <div className="mt-4">
            <DeleteConfirmButton
              action={deleteBudget.bind(null, id)}
              label="Delete"
              confirmText="Delete this budget?"
              className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
