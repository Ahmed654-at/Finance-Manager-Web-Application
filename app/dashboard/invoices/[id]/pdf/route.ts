import { createElement } from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    color: '#0f172a',
  },
  section: {
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
    marginTop: 12,
  },
  totals: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  notes: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
})

function InvoicePdfDocument({
  companyName,
  invoice,
  customer,
  items,
}: {
  companyName: string
  invoice: {
    invoice_number: string
    status: string
    issue_date: string | null
    due_date: string | null
    subtotal: number | string
    tax: number | string
    total: number | string
    notes: string | null
  }
  customer: {
    name: string | null
    email: string | null
  }
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    amount: number
  }>
}) {
  const money = (value: number | string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value || 0))

  const statusColor =
    invoice.status === 'paid'
      ? '#16a34a'
      : invoice.status === 'overdue' || invoice.status === 'draft' || invoice.status === 'sent'
        ? '#dc2626'
        : invoice.status === 'cancelled'
          ? '#64748b'
          : '#dc2626'

  const statusLabel =
    invoice.status === 'paid'
      ? 'PAID'
      : invoice.status === 'overdue'
        ? 'OVERDUE'
        : invoice.status === 'cancelled'
          ? 'CANCELLED'
          : 'UNPAID'

  const lineEntries = items.map((item, index) =>
    createElement(
      View,
      { key: `${item.description}-${index}`, style: styles.row },
      createElement(Text, { style: styles.text }, item.description),
      createElement(Text, { style: styles.text }, String(Number(item.quantity || 0))),
      createElement(Text, { style: styles.text }, money(item.unit_price)),
      createElement(Text, { style: styles.text }, money(item.amount)),
    ),
  )

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          null,
          createElement(Text, { style: styles.title }, companyName),
          createElement(Text, { style: styles.text }, 'Invoice'),
        ),
        createElement(
          View,
          null,
          createElement(Text, { style: styles.label }, 'Invoice number'),
          createElement(Text, { style: styles.text }, invoice.invoice_number),
          createElement(
            Text,
            { style: [{ ...styles.statusBadge, color: statusColor }] },
            statusLabel,
          ),
        ),
      ),
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.label }, 'Bill to'),
        createElement(Text, { style: styles.text }, customer.name || 'Unknown customer'),
        customer.email ? createElement(Text, { style: styles.text }, customer.email) : null,
      ),
      createElement(
        View,
        { style: styles.section },
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Issue date'),
          createElement(Text, { style: styles.text }, invoice.issue_date || '—'),
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Due date'),
          createElement(Text, { style: styles.text }, invoice.due_date || '—'),
        ),
      ),
      createElement(
        View,
        { style: styles.headerRow },
        createElement(Text, { style: styles.label }, 'Description'),
        createElement(Text, { style: styles.label }, 'Qty'),
        createElement(Text, { style: styles.label }, 'Unit price'),
        createElement(Text, { style: styles.label }, 'Amount'),
      ),
      ...lineEntries,
      createElement(
        View,
        { style: styles.totals },
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.label }, 'Subtotal'),
          createElement(Text, { style: styles.text }, money(invoice.subtotal)),
        ),
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.label }, 'Tax'),
          createElement(Text, { style: styles.text }, money(invoice.tax)),
        ),
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.label }, 'Total'),
          createElement(Text, { style: styles.text }, money(invoice.total)),
        ),
      ),
      invoice.notes
        ? createElement(
            View,
            { style: styles.notes },
            createElement(Text, { style: styles.label }, 'Notes'),
            createElement(Text, { style: styles.text }, invoice.notes),
          )
        : null,
    ),
  )
}

export async function buildInvoicePdfBuffer({
  companyName,
  invoice,
  customer,
  items,
}: {
  companyName: string
  invoice: {
    invoice_number: string
    status: string
    issue_date: string | null
    due_date: string | null
    subtotal: number | string
    tax: number | string
    total: number | string
    notes: string | null
  }
  customer: {
    name: string | null
    email: string | null
  }
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    amount: number
  }>
}) {
  const pdfDocument = InvoicePdfDocument({ companyName, invoice, customer, items })
  const { renderToStream } = await import('@react-pdf/renderer')
  const stream = await renderToStream(pdfDocument)
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return new Response('Not found', { status: 404 })
  }

  const companyId = membership.company_id

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, customers(name, email)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return new Response('Not found', { status: 404 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('id')

  const pdfBuffer = await buildInvoicePdfBuffer({
    companyName: company?.name || 'Finance Manager',
    invoice: {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      notes: invoice.notes,
    },
    customer: {
      name: invoice.customers?.name ?? null,
      email: invoice.customers?.email ?? null,
    },
    items: (items ?? []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      amount: Number(item.amount || 0),
    })),
  })

  const safeName = String(invoice.invoice_number || 'invoice').replace(/[^a-zA-Z0-9-_]+/g, '-')

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
    },
  })
}
