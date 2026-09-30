'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

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

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const customerId = String(formData.get('customer_id') ?? '').trim()
  const invoiceNumber = String(formData.get('invoice_number') ?? '').trim()
  const issueDate = String(formData.get('issue_date') ?? '').trim()
  const dueDate = String(formData.get('due_date') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const rawTax = Number(String(formData.get('tax') ?? '0')) || 0
  const serviceType = String(formData.get('service_type') ?? 'ai_service').trim()

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

  if (rawTax < 0) {
    return { error: 'Tax cannot be negative.' }
  }

  // Invoice and line items are saved in a single database transaction (migrations/002_save_invoice.sql).
  const { data: saved, error: saveError } = await supabase.rpc('save_invoice', {
    p_invoice_id: null,
    p_company_id: companyId,
    p_customer_id: customerId,
    p_invoice_number: invoiceNumber,
    p_service_type: serviceType,
    p_issue_date: issueDate || new Date().toISOString().slice(0, 10),
    p_due_date: dueDate || null,
    p_notes: notes || null,
    p_tax: rawTax,
    p_items: validLineItems,
  })

  if (saveError || !saved?.id) {
    return { error: saveError?.message || 'Could not create invoice. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'created',
    entityType: 'invoice',
    entityId: saved.id,
    summary: `Created invoice ${invoiceNumber} for ${saved.total}`,
  })

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}
