import { Resend } from 'resend'
import { formatCurrency } from '@/lib/currency'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendNotificationEmail(to: string, subject: string, message: string) {
  if (!to) {
    return { success: false, error: 'Recipient email is missing.' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is missing in environment variables.' }
  }

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Finance Manager <onboarding@resend.dev>'
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html: `<p>${escapeHtml(message)}</p>`,
    })

    if (error) {
      console.error('Failed to send email notification:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Failed to send email notification:', error)
    return { success: false, error: error?.message || 'Email delivery failed' }
  }
}

export async function sendInvoiceEmail(params: {
  to: string
  customerName: string
  companyName: string
  invoiceNumber: string
  total: number
  dueDate: string | null
  pdfBuffer: Buffer
  type: 'sent' | 'paid'
  currency?: string
}): Promise<{ success: boolean; error?: string; data?: any }> {
  const { to, dueDate, pdfBuffer, type, total } = params
  const customerName = escapeHtml(params.customerName)
  const companyName = escapeHtml(params.companyName)
  const invoiceNumber = escapeHtml(params.invoiceNumber)

  if (!to) {
    return { success: false, error: 'Customer email address is missing on file.' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured in your .env file.' }
  }

  const totalFormatted = formatCurrency(Number(total || 0), params.currency)

  const dueDateLabel = dueDate
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${dueDate}T00:00:00`))
    : 'As soon as possible'

  const subject =
    type === 'paid'
      ? `Payment received — Invoice ${params.invoiceNumber}`
      : `Invoice ${params.invoiceNumber} from ${params.companyName}`

  const html =
    type === 'paid'
      ? `
        <p>Hello ${customerName},</p>
        <p>Thank you for your payment of <strong>${totalFormatted}</strong> for invoice <strong>${invoiceNumber}</strong>.</p>
        <p>We have received your payment and appreciate your business.</p>
        <p>Warm regards,<br />${companyName}</p>
      `
      : `
        <p>Hello ${customerName},</p>
        <p>Here is invoice <strong>${invoiceNumber}</strong> from <strong>${companyName}</strong>.</p>
        <p>The total due is <strong>${totalFormatted}</strong>. Payment is due by <strong>${dueDateLabel}</strong>.</p>
        <p>Please review the attached PDF and let us know if you have any questions.</p>
        <p>Thank you,<br />${companyName}</p>
      `

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Finance Manager <onboarding@resend.dev>'
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: fromAddress,
      to,
      subject,
      html,
    }

    if (pdfBuffer && pdfBuffer.length > 0) {
      payload.attachments = [
        {
          filename:
            type === 'paid' ? `receipt-${params.invoiceNumber}.pdf` : `invoice-${params.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ]
    }

    const { data, error } = await resend.emails.send(payload)

    if (error) {
      console.error(`Resend API error (${type}):`, error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error(`Failed to send invoice email (${type}):`, error)
    return { success: false, error: error?.message || 'Email delivery failed' }
  }
}
