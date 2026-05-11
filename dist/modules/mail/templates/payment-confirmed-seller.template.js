"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentConfirmedSellerTemplate = paymentConfirmedSellerTemplate;
const mail_format_util_1 = require("../utils/mail-format.util");
function paymentConfirmedSellerTemplate(params) {
    const { sellerName, productTitle, amount, buyerName } = params;
    return {
        subject: 'Payment received — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Received</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif;
           background: #f4f6f8; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff;
               border-radius: 12px; overflow: hidden;
               box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
              padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px;
                 font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #d1fae5;
             color: #065f46; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .summary-row { display: flex; justify-content: space-between;
                   padding: 14px 0; border-bottom: 1px solid #f0f0f5;
                   font-size: 15px; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row .label { color: #6b7280; }
    .summary-row .value { font-weight: 600; color: #1a1a2e; }
    .info-box { background: #f0fdf4; border-left: 4px solid #11998e;
                border-radius: 4px; padding: 14px 18px; margin: 20px 0;
                font-size: 14px; color: #065f46; line-height: 1.6; }
    .footer { border-top: 1px solid #f0f0f5; padding: 24px 40px;
              text-align: center; font-size: 12px; color: #aaaacc; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BidsBazar</h1></div>
    <div class="body">
      <p>Hello, ${sellerName}!</p>
      <span class="badge">Payment Confirmed ✓</span>
      <p>Payment has been confirmed for your auction of <strong>${productTitle}</strong>.</p>
      <div class="summary-row">
        <span class="label">Buyer</span>
        <span class="value">${buyerName}</span>
      </div>
      <div class="summary-row">
        <span class="label">Amount received</span>
        <span class="value">${(0, mail_format_util_1.formatCurrency)(amount)}</span>
      </div>
      <div class="info-box">
        Our team will be in touch shortly regarding the payout process and next steps for item handover.
      </div>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=payment-confirmed-seller.template.js.map