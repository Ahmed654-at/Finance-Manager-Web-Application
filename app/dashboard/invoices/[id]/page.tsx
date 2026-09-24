import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DeleteConfirmButton from '../../components/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import { deleteInvoice, sendInvoiceToCustomer, updateInvoiceStatus } from './actions'

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

async function handleStatusUpdate(formData: FormData) {
  'use server'

  const invoiceId = String(formData.get('invoice_id') ?? '')
  const newStatus = String(formData.get('status') ?? '')

  await updateInvoiceStatus(invoiceId, newStatus)
}

async function handleSendInvoice(formData: FormData) {
  'use server'

  const invoiceId = String(formData.get('invoice_id') ?? '')

  await sendInvoiceToCustomer(invoiceId)
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, customers(name, email)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    notFound()
  }

  const { data: lineItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('id')

  const invoiceLineItems = lineItems ?? []
  const canCancel = invoice.status !== 'cancelled' && invoice.status !== 'paid'

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Invoice</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{invoice.invoice_number}</h1>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/invoices"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                ← Back to invoices
              </Link>
              {invoice.status === 'draft' ? (
                <Link
                  href={`/dashboard/invoices/${invoice.id}/edit`}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Edit
                </Link>
              ) : null}
              <DeleteConfirmButton
                action={deleteInvoice.bind(null, invoice.id)}
                label="Delete"
                confirmText={
                  invoice.status === 'draft'
                    ? 'Delete this invoice?'
                    : 'This invoice has already been sent — delete it anyway?'
                }
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
              />
              <a
                href={`/dashboard/invoices/${invoice.id}/pdf`}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Download PDF
              </a>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                  statusClasses[invoice.status] || 'bg-slate-100 text-slate-700'
                }`}
              >
                {invoice.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {invoice.status === 'draft' ? (
                <form action={handleStatusUpdate}>
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <input type="hidden" name="status" value="sent" />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                  >
                    Mark as Sent
                  </button>
                </form>
              ) : null}

              {invoice.status === 'sent' ? (
                <>
                  <form action={handleStatusUpdate}>
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="status" value="paid" />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
                    >
                      Mark as Paid
                    </button>
                  </form>
                  <form action={handleStatusUpdate}>
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="status" value="overdue" />
                    <button
                      type="submit"
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500"
                    >
                      Mark as Overdue
                    </button>
                  </form>
                </>
              ) : null}

              {(invoice.status === 'draft' || invoice.status === 'sent') ? (
                <form action={handleSendInvoice}>
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                  >
                    Send to Customer
                  </button>
                </form>
              ) : null}

              {canCancel ? (
                <form action={handleStatusUpdate}>
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Cancel Invoice
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          {(invoice.status === 'draft' || invoice.status === 'sent') ? (
            <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
              <span>Send to:</span>
              <span className="font-medium text-slate-900">
                {invoice.customers?.email || 'No customer email on file'}
              </span>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Bill to</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{invoice.customers?.name || 'Unknown customer'}</p>
                {invoice.customers?.email ? (
                  <p className="mt-1 text-sm text-slate-600">{invoice.customers.email}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Invoice details</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Issue date</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDate(invoice.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Due date</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDate(invoice.due_date)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Totals</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {currencyFormatter.format(Number(invoice.subtotal || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax</span>
                  <span className="font-medium text-slate-900">
                    {currencyFormatter.format(Number(invoice.tax || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{currencyFormatter.format(Number(invoice.total || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-500">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Unit price</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceLineItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                      No line items for this invoice.
                    </td>
                  </tr>
                ) : (
                  invoiceLineItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 text-sm text-slate-700">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3">{Number(item.quantity || 0)}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(Number(item.unit_price || 0))}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {currencyFormatter.format(Number(item.amount || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {invoice.notes ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{invoice.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
