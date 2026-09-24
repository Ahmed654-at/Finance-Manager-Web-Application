import Link from 'next/link'
import { redirect } from 'next/navigation'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import { createCustomer, deleteCustomer } from './actions'

async function handleCreateCustomer(formData: FormData) {
  'use server'
  await createCustomer(formData)
}

export default async function CustomersPage() {
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

  const { data: customersResult } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  const customers = customersResult ?? []

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <form
            action={handleCreateCustomer}
            className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Customer name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Acme Corp"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                placeholder="Optional phone number"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700">
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                placeholder="Optional address"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add customer
            </button>
          </form>

          {customers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No customers yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Add your first customer to start tracking relationships and details.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{customer.name}</p>
                      {customer.email ? (
                        <p className="mt-1 text-sm text-slate-600">{customer.email}</p>
                      ) : null}
                      {customer.phone ? (
                        <p className="mt-1 text-sm text-slate-600">{customer.phone}</p>
                      ) : null}
                      {customer.address ? (
                        <p className="mt-1 text-sm text-slate-600">{customer.address}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit`}
                        className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                      >
                        Edit
                      </Link>
                      <DeleteConfirmButton
                        action={deleteCustomer.bind(null, customer.id)}
                        label="Delete"
                        confirmText="Delete this customer?"
                        className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
