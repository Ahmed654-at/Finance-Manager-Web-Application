import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendNotificationEmail(to: string, subject: string, message: string) {
  if (!to) {
    return
  }

  try {
    await resend.emails.send({
      from: 'Finance Manager <onboarding@resend.dev>',
      to,
      subject,
      html: `<p>${message}</p>`,
    })
  } catch (error) {
    console.error('Failed to send email notification:', error)
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
}) {
  const { to, customerName, companyName, invoiceNumber, total, dueDate, pdfBuffer, type } = params

  if (!to) {
    return
  }

  const totalFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(total || 0))

  const dueDateLabel = dueDate
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${dueDate}T00:00:00`))
    : 'As soon as possible'

  const subject =
    type === 'paid'
      ? `Payment received — Invoice ${invoiceNumber}`
      : `Invoice ${invoiceNumber} from ${companyName}`

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
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: 'Finance Manager <onboarding@resend.dev>',
      to,
      subject,
      html,
    }

    if (pdfBuffer && pdfBuffer.length > 0) {
      payload.attachments = [
        {
          filename: type === 'paid' ? `receipt-${invoiceNumber}.pdf` : `invoice-${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ]
    }

    await resend.emails.send(payload)
  } catch (error) {
    console.error(`Failed to send invoice email (${type}):`, error)
  }
}
