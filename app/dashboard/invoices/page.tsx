import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const statusClasses: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-700',
}

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function InvoicesPage() {
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

  const { data: invoicesResult, error: invoicesError } = await supabase
    .from('invoices')
    .select('*, customers(name)')
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false })

  const invoices = invoicesResult ?? []

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <div className="mb-6 flex justify-end">
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              + New Invoice
            </Link>
          </div>

          {invoicesError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              There was an error loading your invoices.
            </p>
          ) : invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No invoices yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Create your first invoice to start tracking customer billing and payments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Invoice</th>
                    <th className="pb-3 pr-4 font-medium">Customer</th>
                    <th className="pb-3 pr-4 font-medium">Issue date</th>
                    <th className="pb-3 pr-4 font-medium">Due date</th>
                    <th className="pb-3 pr-4 font-medium">Total</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-medium text-slate-900 transition hover:text-slate-600"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{invoice.customers?.name || 'Unknown customer'}</td>
                      <td className="py-3 pr-4">{formatDate(invoice.issue_date)}</td>
                      <td className="py-3 pr-4">{formatDate(invoice.due_date)}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {currencyFormatter.format(Number(invoice.total || 0))}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            statusClasses[invoice.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
