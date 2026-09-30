import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DeleteConfirmButton from '../../components/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { deleteInvoice, sendInvoiceToCustomer, updateInvoiceStatus } from './actions'

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

  const result = await sendInvoiceToCustomer(invoiceId)
  if (result?.error) {
    redirect(`/dashboard/invoices/${invoiceId}?error=${encodeURIComponent(result.error)}`)
  }

  redirect(`/dashboard/invoices/${invoiceId}?sent=1`)
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ sent?: string; error?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const sent = resolvedSearchParams?.sent
  const errorMessage = resolvedSearchParams?.error

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, company } = await getCompanyContext(supabase, user)

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
        {sent === '1' && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">Invoice Email Sent Successfully</h3>
              <p className="mt-1 text-xs text-emerald-700">
                The invoice email and PDF attachment have been dispatched to{' '}
                <span className="font-semibold">{invoice.customers?.email}</span>.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900">Email Delivery Failed</h3>
                <p className="mt-1 font-mono text-xs text-red-800 rounded border border-red-200 bg-red-100/70 p-2 break-all">
                  {errorMessage}
                </p>

                {(errorMessage.toLowerCase().includes('testing emails') ||
                  errorMessage.toLowerCase().includes('resend.com/domains') ||
                  errorMessage.toLowerCase().includes('validation_error')) && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-semibold text-amber-950">Why did this happen?</p>
                    <p className="mt-1 leading-relaxed">
                      Your Resend account is currently in free <strong>Sandbox mode</strong> (using{' '}
                      <code>onboarding@resend.dev</code>). Resend restricts test emails strictly to the email address
                      registered to that Resend account.
                    </p>
                    <p className="mt-2 font-medium text-amber-950">How to deliver emails to your inbox or customers:</p>
                    <ul className="mt-1 list-disc pl-4 space-y-1 text-amber-900">
                      <li>
                        <strong>Free option (for testing):</strong> Sign up free at{' '}
                        <a href="https://resend.com" target="_blank" rel="noreferrer" className="font-semibold underline">
                          resend.com
                        </a>{' '}
                        with your personal email, copy your API key, and put it in <code>.env</code> as{' '}
                        <code>RESEND_API_KEY</code>. You can then test sending to your own email address!
                      </li>
                      <li>
                        <strong>Production option:</strong> Add and verify your company domain at{' '}
                        <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="font-semibold underline">
                          resend.com/domains
                        </a>{' '}
                        to send to any customer email address worldwide.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Invoice</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{invoice.invoice_number}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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

          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                    {formatCurrency(Number(invoice.subtotal || 0), company.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(Number(invoice.tax || 0), company.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(Number(invoice.total || 0), company.currency)}</span>
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
                      <td className="px-4 py-3">{formatCurrency(Number(item.unit_price || 0), company.currency)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatCurrency(Number(item.amount || 0), company.currency)}
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
