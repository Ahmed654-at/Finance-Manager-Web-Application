import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InvoiceEditForm from './InvoiceEditForm'

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const { id } = await Promise.resolve(params)

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

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!invoice) {
    redirect('/dashboard/invoices')
  }

  if (invoice.status !== 'draft') {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Invoices</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit invoice</h1>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Only draft invoices can be edited.
            </p>
            <Link
              href={`/dashboard/invoices/${invoice.id}`}
              className="mt-4 inline-block text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to invoice
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const { data: customersResult } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name')

  const { data: lineItemsResult } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('id')

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Invoices</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit invoice</h1>
            </div>
            <Link
              href={`/dashboard/invoices/${invoice.id}`}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to invoice
            </Link>
          </div>

          <InvoiceEditForm
            customers={(customersResult ?? []) as Array<{ id: string; name: string }>}
            invoice={invoice as {
              id: string
              customer_id: string | null
              invoice_number: string
              issue_date: string | null
              due_date: string | null
              notes: string | null
              tax: number | string | null
            }}
            lineItems={(lineItemsResult ?? []) as Array<{
              id: string
              description: string
              quantity: number
              unit_price: number
            }>}
          />
        </div>
      </div>
    </main>
  )
}
