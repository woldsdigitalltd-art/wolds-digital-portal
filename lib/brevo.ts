import 'server-only'

interface BrevoAddress {
  email: string
  name?: string
}

interface SendTransactionalEmailOptions {
  to: BrevoAddress[]
  subject: string
  htmlContent: string
  textContent: string
  replyTo?: BrevoAddress
  /** Optional tags used for Brevo analytics */
  tags?: string[]
}

/**
 * Send a transactional email via Brevo (formerly Sendinblue).
 * https://developers.brevo.com/reference/sendtransacemail
 */
export async function sendTransactionalEmail(opts: SendTransactionalEmailOptions) {
  const apiKey       = process.env.BREVO_API_KEY
  const senderEmail  = process.env.BREVO_SENDER_EMAIL
  const senderName   = process.env.BREVO_SENDER_NAME ?? 'Wolds Digital'
  const replyTo      = opts.replyTo ?? {
    email: process.env.BREVO_REPLY_TO_EMAIL ?? senderEmail!,
    name:  senderName,
  }

  if (!apiKey || !senderEmail) {
    throw new Error(
      'Missing Brevo credentials: BREVO_API_KEY and BREVO_SENDER_EMAIL must be set.'
    )
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      apiKey,
      'content-type': 'application/json',
      accept:         'application/json',
    },
    body: JSON.stringify({
      sender:      { email: senderEmail, name: senderName },
      to:          opts.to,
      subject:     opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent,
      replyTo,
      tags:        opts.tags,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Brevo send failed (${response.status} ${response.statusText}): ${detail}`
    )
  }

  return (await response.json()) as { messageId: string }
}
