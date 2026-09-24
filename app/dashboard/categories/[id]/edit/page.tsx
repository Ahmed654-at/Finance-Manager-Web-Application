'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeleteConfirmButton from '../../../components/DeleteConfirmButton'
import { deleteCategory, updateCategory } from '../../actions'

type CategoryRecord = {
  id: string
  name: string
  type: 'income' | 'expense'
  description: string | null
}

export default function EditCategoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [category, setCategory] = useState<CategoryRecord | null>(null)
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

      const { data: categoryData } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('company_id', membership.company_id)
        .limit(1)
        .maybeSingle()

      if (!categoryData) {
        router.push('/dashboard/categories')
        return
      }

      setCategory(categoryData as CategoryRecord)
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
      const result = await updateCategory(id, formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      router.push('/dashboard/categories')
    })
  }

  if (loading || !category) {
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
              <p className="text-sm font-medium text-slate-500">Categories</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit category</h1>
            </div>
            <Link
              href="/dashboard/categories"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to categories
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Category name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={category.name}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={category.type}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                id="description"
                name="description"
                type="text"
                defaultValue={category.description ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
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
              {isPending ? 'Saving...' : 'Save category'}
            </button>
          </form>

          <div className="mt-4">
            <DeleteConfirmButton
              action={deleteCategory.bind(null, id)}
              label="Delete"
              confirmText="Delete this category?"
              className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
