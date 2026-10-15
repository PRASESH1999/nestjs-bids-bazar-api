import { escapeHtml } from '../utils/mail-format.util';

export interface ContactMessageTemplateParams {
  ticket: string;
  topicLabel: string;
  fullName: string;
  email: string;
  phone?: string;
  referenceId?: string;
  message: string;
}

const STYLES = `
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif;
           background: #f4f6f8; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff;
               border-radius: 12px; overflow: hidden;
               box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: #E36F5F; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #FDEFEC;
             color: #C4503D; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 22px; }
    .summary-row { padding: 10px 0; border-bottom: 1px solid #f0f0f5; font-size: 14px; }
    .summary-row .label { color: #6b7280; }
    .summary-row .value { font-weight: 600; color: #1a1a2e; }
    .message { margin-top: 22px; padding: 16px 18px; background: #faf7f5;
               border-radius: 10px; font-size: 15px; line-height: 1.65;
               color: #1a1a2e; white-space: pre-wrap; }
    .footer { border-top: 1px solid #f0f0f5; padding: 22px 40px;
              text-align: center; font-size: 12px; color: #aaaacc; }`;

/**
 * Every value here comes from a public form, so each one is escaped — unlike
 * the other templates, which only ever interpolate server data.
 */
function summary(params: ContactMessageTemplateParams): string {
  const rows: [string, string | undefined][] = [
    ['Topic', params.topicLabel],
    ['Name', params.fullName],
    ['Email', params.email],
    ['Phone', params.phone ? `+977 ${params.phone}` : undefined],
    ['Order / transaction ID', params.referenceId],
  ];
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<div class="summary-row"><span class="label">${label}:</span> <span class="value">${escapeHtml(value)}</span></div>`,
    )
    .join('\n      ');
}

function page(title: string, inner: string, footer: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${STYLES}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BidsBazar</h1></div>
    <div class="body">
      ${inner}
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. ${footer}</div>
  </div>
</body>
</html>`;
}

/** The message as it reaches the support inbox. Reply-To is the sender. */
export function contactMessageTemplate(params: ContactMessageTemplateParams): {
  subject: string;
  html: string;
} {
  return {
    subject: `[${params.ticket}] ${params.topicLabel} — ${params.fullName.slice(0, 60)}`,
    html: page(
      'Contact Us message',
      `<span class="badge">Contact Us · ${params.ticket}</span>
      ${summary(params)}
      <div class="message">${escapeHtml(params.message)}</div>`,
      'Sent from the Contact Us form. Reply to this email to answer the sender.',
    ),
  };
}

/** The sender's copy: what they sent, and when to expect an answer. */
export function contactAcknowledgementTemplate(
  params: ContactMessageTemplateParams,
): { subject: string; html: string } {
  const firstName = params.fullName.split(/\s+/)[0] || 'there';
  return {
    subject: `We received your message [${params.ticket}] — BidsBazar`,
    html: page(
      'Message received',
      `<span class="badge">Ticket ${params.ticket}</span>
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thanks for getting in touch. Our team in Lalitpur replies within one working day.
      Quote <strong>${params.ticket}</strong> if you write to us about this again.</p>
      <p>Here is a copy of what you sent:</p>
      ${summary(params)}
      <div class="message">${escapeHtml(params.message)}</div>
      <p style="margin-top:22px">BidsBazar will never ask for your password, PIN or OTP.</p>`,
      'You are receiving this because you used our Contact Us form.',
    ),
  };
}
