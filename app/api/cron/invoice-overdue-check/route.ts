import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: overdueInvoices, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, company_id, customer_id, due_date, customers(name)')
    .eq('status', 'sent')
    .not('due_date', 'is', null)
    .lt('due_date', today)

  if (invoiceError) {
    return NextResponse.json({ error: 'Failed to load overdue invoices' }, { status: 500 })
  }

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ updated: 0, notifications: 0 })
  }

  let updatedCount = 0
  let notificationCount = 0

  for (const invoice of overdueInvoices) {
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('id', invoice.id)

    if (updateError) {
      continue
    }

    updatedCount += 1

    const customerRows = Array.isArray(invoice.customers) ? invoice.customers : invoice.customers ? [invoice.customers] : []
    const customerName = customerRows[0]?.name || 'Customer'
    const { data: members } = await supabaseAdmin
      .from('company_members')
      .select('user_id')
      .eq('company_id', invoice.company_id)

    if (!members || members.length === 0) {
      continue
    }

    for (const member of members) {
      const message = `Invoice ${invoice.invoice_number} for ${customerName} is now overdue.`

      const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
        company_id: invoice.company_id,
        user_id: member.user_id,
        message,
        is_read: false,
      })

      if (notificationError) {
        continue
      }

      notificationCount += 1

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
      const email = userData?.user?.email

      if (!userError && email) {
        await sendNotificationEmail(email, 'Invoice Overdue', message)
      }
    }
  }

  return NextResponse.json({ updated: updatedCount, notifications: notificationCount })
}
