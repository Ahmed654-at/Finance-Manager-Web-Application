'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

type InvoiceLineItem = {
  description: string
  quantity: number
  unit_price: number
}

export async function createInvoice(formData: FormData) {
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

  const customerId = String(formData.get('customer_id') ?? '').trim()
  const invoiceNumber = String(formData.get('invoice_number') ?? '').trim()
  const issueDate = String(formData.get('issue_date') ?? '').trim()
  const dueDate = String(formData.get('due_date') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const rawTax = Number(String(formData.get('tax') ?? '0')) || 0

  if (!customerId) {
    return { error: 'Please select a customer.' }
  }

  if (!invoiceNumber) {
    return { error: 'Invoice number is required.' }
  }

  let lineItems: InvoiceLineItem[] = []

  try {
    const rawLineItems = String(formData.get('line_items') ?? '[]')
    const parsedLineItems = JSON.parse(rawLineItems)

    if (Array.isArray(parsedLineItems)) {
      lineItems = parsedLineItems
        .map((item) => ({
          description: String(item?.description ?? '').trim(),
          quantity: Number(item?.quantity ?? 0),
          unit_price: Number(item?.unit_price ?? 0),
        }))
        .filter((item) => item.description || item.quantity > 0 || item.unit_price > 0)
    }
  } catch {
    lineItems = []
  }

  const validLineItems = lineItems.filter(
    (item) => item.description && item.quantity > 0 && item.unit_price > 0,
  )

  if (validLineItems.length === 0) {
    return {
      error: 'Add at least one valid line item with a description, quantity, and unit price.',
    }
  }

  const subtotal = validLineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
    0,
  )
  const total = subtotal + Number(rawTax)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: membership.company_id,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      issue_date: issueDate || new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
      subtotal,
      tax: Number(rawTax),
      total,
      status: 'draft',
      notes: notes || null,
    })
    .select('id')
    .single()

  if (invoiceError || !invoice?.id) {
    return { error: 'Could not create invoice. Please try again.' }
  }

  const itemsToInsert = validLineItems.map((item) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    amount: Number(item.quantity) * Number(item.unit_price),
  }))

  for (const item of itemsToInsert) {
    await supabase.from('invoice_items').insert(item)
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'created',
    entityType: 'invoice',
    entityId: invoice.id,
    summary: `Created invoice ${invoiceNumber} for ${total}`,
  })

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}
