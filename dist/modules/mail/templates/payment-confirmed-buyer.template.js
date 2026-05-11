"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentConfirmedBuyerTemplate = paymentConfirmedBuyerTemplate;
const mail_format_util_1 = require("../utils/mail-format.util");
function paymentConfirmedBuyerTemplate(params) {
    const { buyerName, productTitle, amount } = params;
    return {
        subject: 'Payment confirmed — Your purchase is complete — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Purchase Complete</title>
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
    .receipt-box { background: #f0fdf4; border-radius: 8px;
                   padding: 20px 24px; margin: 0 0 24px; }
    .receipt-row { display: flex; justify-content: space-between;
                   padding: 8px 0; border-bottom: 1px solid #bbf7d0;
                   font-size: 15px; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-row .label { color: #6b7280; }
    .receipt-row .value { font-weight: 600; color: #065f46; }
    .info-box { background: #f9fafb; border-left: 4px solid #d1d5db;
                border-radius: 4px; padding: 14px 18px; margin: 20px 0;
                font-size: 14px; color: #374151; line-height: 1.6; }
    .footer { border-top: 1px solid #f0f0f5; padding: 24px 40px;
              text-align: center; font-size: 12px; color: #aaaacc; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BidsBazar</h1></div>
    <div class="body">
      <p>Thank you, ${buyerName}!</p>
      <span class="badge">Purchase Complete ✓</span>
      <p>Your payment has been confirmed. Here is your receipt:</p>
      <div class="receipt-box">
        <div class="receipt-row">
          <span class="label">Item</span>
          <span class="value">${productTitle}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Amount paid</span>
          <span class="value">${(0, mail_format_util_1.formatCurrency)(amount)}</span>
        </div>
      </div>
      <div class="info-box">
        The seller will contact you directly with delivery details. If you have any
        questions in the meantime, please reach out to our support team.
      </div>
      <p>Thank you for using BidsBazar — enjoy your purchase!</p>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=payment-confirmed-buyer.template.js.map