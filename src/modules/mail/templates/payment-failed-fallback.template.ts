import { formatCurrency, formatDateTime } from '../utils/mail-format.util';

export interface PaymentFailedFallbackTemplateParams {
  bidderName: string;
  productTitle: string;
  winningAmount: number | string;
  paymentDeadline: Date;
  fallbackRank: number;
  paymentUrl: string;
}

export function paymentFailedFallbackTemplate(
  params: PaymentFailedFallbackTemplateParams,
): { subject: string; html: string } {
  const {
    bidderName,
    productTitle,
    winningAmount,
    paymentDeadline,
    fallbackRank,
    paymentUrl,
  } = params;
  return {
    subject: "You've won by fallback — Pay within 18 hours — BidsBazar",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fallback Winner</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif;
           background: #f4f6f8; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff;
               border-radius: 12px; overflow: hidden;
               box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px;
                 font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #ede9fe;
             color: #5b21b6; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .info-box { background: #f5f3ff; border-left: 4px solid #7c3aed;
                border-radius: 4px; padding: 14px 18px; margin: 0 0 20px; }
    .info-box .label { font-size: 12px; color: #6b7280; text-transform: uppercase;
                       letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-box .value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .warning-box { background: #fef2f2; border-left: 4px solid #dc2626;
                   border-radius: 4px; padding: 14px 18px; margin: 20px 0;
                   font-size: 14px; color: #991b1b; line-height: 1.6; }
    .cta { display: block; width: fit-content; margin: 28px auto;
           padding: 14px 36px;
           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      <p>Congratulations, ${bidderName}!</p>
      <span class="badge">Fallback Winner #${fallbackRank}</span>
      <p>
        The previous winner did not complete payment in time, so <strong>${productTitle}</strong>
        has been awarded to you as the next highest bidder.
      </p>
      <div class="info-box">
        <div class="label">Amount Due</div>
        <div class="value">${formatCurrency(winningAmount)}</div>
      </div>
      <div class="info-box">
        <div class="label">Payment Deadline</div>
        <div class="value">${formatDateTime(paymentDeadline)}</div>
      </div>
      <div class="warning-box">
        ⚠️ <strong>Important:</strong> You must pay by the deadline above.
        Missing it will forfeit your win and pass the item to the next bidder.
      </div>
      <a href="${paymentUrl}" class="cta">Pay Now</a>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
  };
}
