"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentFailedSellerTemplate = paymentFailedSellerTemplate;
const mail_format_util_1 = require("../utils/mail-format.util");
function paymentFailedSellerTemplate(params) {
    const { sellerName, productTitle, failedBidderRank, newWinnerName, newWinnerBidAmount, } = params;
    const rankLabel = failedBidderRank === 0
        ? 'the original winner'
        : `fallback winner #${failedBidderRank}`;
    return {
        subject: 'Winner failed to pay — Fallback initiated — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Failed — Fallback</title>
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
    .summary-row { display: flex; justify-content: space-between;
                   padding: 14px 0; border-bottom: 1px solid #f0f0f5;
                   font-size: 15px; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row .label { color: #6b7280; }
    .summary-row .value { font-weight: 600; color: #1a1a2e; }
    .footer { border-top: 1px solid #f0f0f5; padding: 24px 40px;
              text-align: center; font-size: 12px; color: #aaaacc; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BidsBazar</h1></div>
    <div class="body">
      <p>Hello, ${sellerName},</p>
      <span class="badge">Payment Failed — Fallback Active</span>
      <p>
        Unfortunately, ${rankLabel} for <strong>${productTitle}</strong>
        did not complete payment within their window.
      </p>
      <p>The next highest bidder has been automatically promoted:</p>
      <div class="summary-row">
        <span class="label">New winner</span>
        <span class="value">${newWinnerName}</span>
      </div>
      <div class="summary-row">
        <span class="label">Their bid</span>
        <span class="value">${(0, mail_format_util_1.formatCurrency)(newWinnerBidAmount)}</span>
      </div>
      <p>
        The new winner has been notified and given 18 hours to pay.
        You will be updated again once payment is confirmed or if the chain advances further.
      </p>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=payment-failed-seller.template.js.map