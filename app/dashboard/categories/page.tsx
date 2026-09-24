import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import { createCategory, deleteCategory } from './actions'

async function handleCreateCategory(formData: FormData) {
  'use server'
  await createCategory(formData)
}

export default async function CategoriesPage() {
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

  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('company_id', membership.company_id)

  if (!existingCategories || existingCategories.length === 0) {
    const defaultExpenseCategories = [
      { company_id: membership.company_id, name: 'Software', type: 'expense', description: 'Software and tools' },
      { company_id: membership.company_id, name: 'Marketing', type: 'expense', description: 'Campaign and promotion spend' },
      { company_id: membership.company_id, name: 'Rent', type: 'expense', description: 'Office or property rent' },
      { company_id: membership.company_id, name: 'Invoices', type: 'expense', description: 'Vendor and supplier invoices' },
    ]

    await supabase.from('categories').insert(defaultExpenseCategories)
  }

  const { data: categoriesResult } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name')

  const categories = categoriesResult ?? []
  const incomeCategories = categories.filter((category) => category.type === 'income')
  const expenseCategories = categories.filter((category) => category.type === 'expense')

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <form action={handleCreateCategory} className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Category name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Marketing"
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
                defaultValue="expense"
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
                placeholder="Optional note"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add category
            </button>
          </form>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-emerald-700">Income Categories</h2>
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-slate-500">No income categories yet</p>
              ) : (
                <div className="space-y-3">
                  {incomeCategories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-xl border border-emerald-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{category.name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {category.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/categories/${category.id}/edit`}
                            className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                          >
                            Edit
                          </Link>
                          <DeleteConfirmButton
                            action={deleteCategory.bind(null, category.id)}
                            label="Delete"
                            confirmText="Delete this category?"
                            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-red-700">Expense Categories</h2>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-slate-500">No expense categories yet</p>
              ) : (
                <div className="space-y-3">
                  {expenseCategories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-xl border border-red-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{category.name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {category.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/categories/${category.id}/edit`}
                            className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                          >
                            Edit
                          </Link>
                          <DeleteConfirmButton
                            action={deleteCategory.bind(null, category.id)}
                            label="Delete"
                            confirmText="Delete this category?"
                            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

