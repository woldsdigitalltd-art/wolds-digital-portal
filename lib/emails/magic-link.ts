/**
 * Renders the branded "Magic link" email used by the Wolds Digital client portal.
 * Uses inline styles + table layout for maximum email-client compatibility.
 */

const NAVY  = '#0B2545'
const NAVY_700 = '#254370'
const NAVY_500 = '#3c6aa1'
const NAVY_100 = '#dde7f2'
const BRAND_500 = '#7CA653'
const BRAND_700 = '#4a6633'

const LOGO_URL = 'https://woldsdigital.com/wolds-digital-logo.png'
const SITE_NAME = 'Wolds Digital'
const SUPPORT_EMAIL = 'hello@woldsdigital.com'

export interface MagicLinkEmail {
  subject: string
  html: string
  text: string
}

export function renderMagicLinkEmail({
  magicLink,
  recipientEmail,
}: {
  magicLink: string
  recipientEmail: string
}): MagicLinkEmail {
  const subject = 'Your sign-in link for the Wolds Digital client portal'

  const text = [
    `Hi there,`,
    ``,
    `Click the link below to sign in to your ${SITE_NAME} client portal.`,
    `This link will expire in 1 hour and can only be used once.`,
    ``,
    magicLink,
    ``,
    `If you didn't request this email, you can safely ignore it — nobody can`,
    `sign in without this link.`,
    ``,
    `Need help? Just reply to this email or contact us at ${SUPPORT_EMAIL}.`,
    ``,
    `— The Wolds Digital team`,
    `IT Consultancy & Website Development · East Riding of Yorkshire`,
  ].join('\n')

  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(subject)}</title>
    <!--[if mso]>
    <style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style>
    <![endif]-->
  </head>
  <body style="margin:0; padding:0; background-color:#f7faf3; color:${NAVY}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Preheader (hidden in body, shown in inbox preview) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f7faf3;">
      Sign in to your Wolds Digital client portal. Link expires in 1 hour.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f7faf3;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background-color:#ffffff; border:1px solid ${NAVY_100}; border-radius:24px; box-shadow:0 4px 16px rgba(11,37,69,0.04);">
            <!-- Header / logo -->
            <tr>
              <td align="center" style="padding:32px 32px 16px 32px;">
                <img
                  src="${LOGO_URL}"
                  alt="${SITE_NAME}"
                  width="160"
                  height="160"
                  style="display:block; border:0; outline:none; text-decoration:none; height:auto; max-width:160px; width:160px;"
                />
              </td>
            </tr>

            <!-- Eyebrow -->
            <tr>
              <td align="center" style="padding:0 32px 8px 32px;">
                <span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:${BRAND_700};">
                  Client Portal
                </span>
              </td>
            </tr>

            <!-- Heading -->
            <tr>
              <td align="center" style="padding:0 32px 12px 32px;">
                <h1 style="margin:0; font-size:28px; font-weight:700; line-height:1.2; color:${NAVY}; letter-spacing:-0.01em;">
                  Welcome back<span style="color:${BRAND_500};">.</span>
                </h1>
              </td>
            </tr>

            <!-- Body copy -->
            <tr>
              <td align="center" style="padding:0 40px 28px 40px;">
                <p style="margin:0; font-size:15px; line-height:1.6; color:${NAVY_700};">
                  Click the button below to sign in to your ${SITE_NAME} client portal.
                  This link will expire in <strong>1 hour</strong> and can only be used once.
                </p>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td align="center" style="padding:0 32px 36px 32px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${magicLink}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" stroke="f" fillcolor="${NAVY}">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Sign in to your portal</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a
                  href="${magicLink}"
                  style="background-color:${NAVY}; border-radius:9999px; color:#ffffff; display:inline-block; font-size:15px; font-weight:600; line-height:1; padding:18px 36px; text-decoration:none; text-align:center; mso-padding-alt:0; min-width:200px;"
                >
                  Sign in to your portal
                </a>
                <!--<![endif]-->
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px; background-color:${NAVY_100}; line-height:1px; font-size:0;">&nbsp;</div>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:24px 40px 8px 40px;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${NAVY_500};">
                  This message was sent to <strong style="color:${NAVY_700};">${escapeHtml(recipientEmail)}</strong>.
                  If you didn't request this email, you can safely ignore it — nobody can sign in without this link.
                </p>
              </td>
            </tr>

            <!-- Help -->
            <tr>
              <td style="padding:8px 40px 32px 40px;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${NAVY_500};">
                  Need help? Just reply to this email or contact us at
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_700}; text-decoration:none; font-weight:600;">${SUPPORT_EMAIL}</a>.
                </p>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:24px 16px 0 16px;">
                <p style="margin:0; font-size:11px; line-height:1.6; color:${NAVY_500};">
                  <strong style="color:${NAVY};">${SITE_NAME} Ltd</strong><br />
                  IT Consultancy &amp; Website Development · East Riding of Yorkshire
                </p>
                <p style="margin:8px 0 0 0; font-size:11px; color:${NAVY_500};">
                  &copy; ${new Date().getFullYear()} ${SITE_NAME} Ltd. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
