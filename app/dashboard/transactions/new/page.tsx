import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TransactionForm from './TransactionForm'

type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
}

type Account = {
  id: string
  name: string
}

export default async function NewTransactionPage() {
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

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name')

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Transactions</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Add transaction</h1>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          {categories && categories.length === 0 ? (
            <p className="mb-4 text-xs text-slate-500">
              No categories yet — you can leave this blank or add categories later
            </p>
          ) : null}

          <TransactionForm
            categories={(categories ?? []) as Category[]}
            accounts={(accounts ?? []) as Account[]}
          />
        </div>
      </div>
    </main>
  )
}
