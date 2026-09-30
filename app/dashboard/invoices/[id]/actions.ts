'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { sendInvoiceEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'
import { buildInvoicePdfBuffer } from './pdf/route'

const VALID_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const

type InvoiceLineItem = {
  description: string
  quantity: number
  unit_price: number
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  if (!invoiceId) {
    return { error: 'Invoice ID is required.' }
  }

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

  const { data: invoice, error: invoiceLookupError } = await supabase
    .from('invoices')
    .select('id, company_id, status, invoice_number')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (invoiceLookupError || !invoice) {
    return { error: 'Invoice not found.' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Only draft invoices can be edited.' }
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

  if (rawTax < 0) {
    return { error: 'Tax cannot be negative.' }
  }

  // Invoice and line items are saved in a single database transaction (migrations/002_save_invoice.sql).
  const { data: saved, error: saveError } = await supabase.rpc('save_invoice', {
    p_invoice_id: invoiceId,
    p_company_id: companyId,
    p_customer_id: customerId,
    p_invoice_number: invoiceNumber,
    p_service_type: null,
    p_issue_date: issueDate || new Date().toISOString().slice(0, 10),
    p_due_date: dueDate || null,
    p_notes: notes || null,
    p_tax: rawTax,
    p_items: validLineItems,
  })

  if (saveError || !saved?.id) {
    return { error: saveError?.message || 'Could not update invoice. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'updated',
    entityType: 'invoice',
    entityId: invoiceId,
    summary: `Updated invoice ${invoiceNumber} for ${saved.total}`,
  })

  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/invoices/[id]')
  redirect(`/dashboard/invoices/${invoiceId}`)
}

export async function deleteInvoice(invoiceId: string) {
  if (!invoiceId) {
    return { error: 'Invoice ID is required.' }
  }

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

  const { data: invoiceToDelete } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!invoiceToDelete) {
    return { error: 'Invoice not found.' }
  }

  const { error: deleteItemsError } = await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)

  if (deleteItemsError) {
    return { error: 'Could not delete invoice items. Please try again.' }
  }

  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: deleteError?.message || 'Could not delete invoice. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'deleted',
    entityType: 'invoice',
    entityId: invoiceId,
    summary: `Deleted invoice ${invoiceToDelete.invoice_number}`,
  })

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}

export async function sendInvoiceToCustomer(invoiceId: string) {
  if (!invoiceId) {
    return { error: 'Invoice ID is required.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return { error: 'You must be logged in to send invoices.' }
  }

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const { data: invoice, error: invoiceLookupError } = await supabase
    .from('invoices')
    .select('*, customers(name, email)')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (invoiceLookupError || !invoice) {
    return { error: 'Invoice not found.' }
  }

  const customerEmail = invoice.customers?.email?.trim()

  if (!customerEmail) {
    return { error: 'This customer has no email address on file.' }
  }

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
      email: customerEmail,
    },
    items: (items ?? []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      amount: Number(item.amount || 0),
    })),
  })

  const emailResult = await sendInvoiceEmail({
    to: customerEmail,
    customerName: invoice.customers?.name || 'Customer',
    companyName: company?.name || 'Finance Manager',
    invoiceNumber: invoice.invoice_number,
    total: Number(invoice.total || 0),
    dueDate: invoice.due_date,
    pdfBuffer,
    type: 'sent',
    currency: company?.currency,
  })

  if (!emailResult.success) {
    return {
      error:
        emailResult.error ||
        'Failed to deliver invoice email. Please check your Resend configuration.',
    }
  }

  const nextStatus = invoice.status === 'paid' ? invoice.status : 'sent'

  if (nextStatus !== invoice.status) {
    const { error: statusError } = await supabase
      .from('invoices')
      .update({ status: nextStatus })
      .eq('id', invoiceId)
      .eq('company_id', companyId)

    if (statusError) {
      return { error: 'Could not update invoice status.' }
    }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: nextStatus !== invoice.status ? 'status_changed' : 'sent',
    entityType: 'invoice',
    entityId: invoiceId,
    summary: `Emailed invoice ${invoice.invoice_number} to ${customerEmail}`,
  })

  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/invoices/[id]')

  return { success: true }
}

export async function updateInvoiceStatus(invoiceId: string, newStatus: string) {
  if (!invoiceId) {
    return { error: 'Invoice ID is required.' }
  }

  if (!VALID_STATUSES.includes(newStatus as (typeof VALID_STATUSES)[number])) {
    return { error: 'Invalid invoice status.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return { error: 'You must be logged in to update invoices.' }
  }

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', invoiceId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: 'Could not update invoice status.' }
  }

  if (newStatus === 'paid') {
    try {
      const { data: invoiceData, error: invoiceDataError } = await supabase
        .from('invoices')
        .select('*, customers(name, email)')
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .maybeSingle()

      if (!invoiceDataError && invoiceData) {
        const customerEmail = invoiceData.customers?.email?.trim()

        if (customerEmail) {

          const { data: items } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('id')

          const pdfBuffer = await buildInvoicePdfBuffer({
            companyName: company?.name || 'Finance Manager',
            invoice: {
              invoice_number: invoiceData.invoice_number,
              status: 'paid',
              issue_date: invoiceData.issue_date,
              due_date: invoiceData.due_date,
              subtotal: invoiceData.subtotal,
              tax: invoiceData.tax,
              total: invoiceData.total,
              notes: invoiceData.notes,
            },
            customer: {
              name: invoiceData.customers?.name ?? null,
              email: customerEmail,
            },
            items: (items ?? []).map((item) => ({
              description: item.description,
              quantity: Number(item.quantity || 0),
              unit_price: Number(item.unit_price || 0),
              amount: Number(item.amount || 0),
            })),
          })

          await sendInvoiceEmail({
            to: customerEmail,
            customerName: invoiceData.customers?.name || 'Customer',
            companyName: company?.name || 'Finance Manager',
            invoiceNumber: invoiceData.invoice_number,
            total: Number(invoiceData.total || 0),
            dueDate: invoiceData.due_date,
            pdfBuffer,
            type: 'paid',
            currency: company?.currency,
          })
        }
      }
    } catch (error) {
      console.error('Failed to send payment confirmation email:', error)
    }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'status_changed',
    entityType: 'invoice',
    entityId: invoiceId,
    summary: `Changed invoice status to ${newStatus}`,
  })

  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/invoices/[id]')

  return { success: true }
}
