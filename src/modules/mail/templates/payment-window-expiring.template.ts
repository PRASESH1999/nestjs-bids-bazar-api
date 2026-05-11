import { formatCurrency, formatDateTime } from '../utils/mail-format.util';

export interface PaymentWindowExpiringTemplateParams {
  bidderName: string;
  productTitle: string;
  amount: number | string;
  paymentDeadline: Date;
  paymentUrl: string;
}

export function paymentWindowExpiringTemplate(
  params: PaymentWindowExpiringTemplateParams,
): { subject: string; html: string } {
  const { bidderName, productTitle, amount, paymentDeadline, paymentUrl } =
    params;
  return {
    subject: 'Payment window closing soon — 2 hours left — BidsBazar',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Closing Soon</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif;
           background: #f4f6f8; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff;
               border-radius: 12px; overflow: hidden;
               box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px;
                 font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #fee2e2;
             color: #991b1b; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .urgent-box { background: #fef2f2; border: 2px solid #dc2626;
                  border-radius: 8px; padding: 18px 20px; margin: 0 0 24px;
                  text-align: center; }
    .urgent-box .deadline-label { font-size: 12px; color: #9ca3af;
                                   text-transform: uppercase; letter-spacing: 0.5px;
                                   margin-bottom: 8px; }
    .urgent-box .deadline-value { font-size: 20px; font-weight: 700; color: #dc2626; }
    .info-box { background: #f9fafb; border-left: 4px solid #d1d5db;
                border-radius: 4px; padding: 12px 16px; margin: 0 0 20px;
                font-size: 15px; color: #374151; }
    .cta { display: block; width: fit-content; margin: 28px auto;
           padding: 14px 36px;
           background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
           color: #ffffff !important; text-decoration: none; border-radius: 8px;
           font-size: 16px; font-weight: 600; letter-spacing: 0.2px; }
    .footer { border-top: 1px solid #f0f0f5; padding: 24px 40px;
              text-align: center; font-size: 12px; color: #aaaacc; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BidsBazar</h1></div>
    <div class="body">
      <p>Hello, ${bidderName},</p>
      <span class="badge">⚠️ Urgent — Payment Due Soon</span>
      <p>Your payment window for <strong>${productTitle}</strong> is closing in approximately <strong>2 hours</strong>.</p>
      <div class="urgent-box">
        <div class="deadline-label">Payment Deadline</div>
        <div class="deadline-value">${formatDateTime(paymentDeadline)}</div>
      </div>
      <div class="info-box">Amount due: <strong>${formatCurrency(amount)}</strong></div>
      <p>
        If payment is not received by the deadline, your win will be forfeited
        and the item will be offered to the next bidder.
      </p>
      <a href="${paymentUrl}" class="cta">Pay Now</a>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
  };
}
