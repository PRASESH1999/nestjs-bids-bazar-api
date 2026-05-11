"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bidPlacedSellerTemplate = bidPlacedSellerTemplate;
const mail_format_util_1 = require("../utils/mail-format.util");
function bidPlacedSellerTemplate(params) {
    const { sellerName, productTitle, bidAmount, biddingEndsAt, auctionUrl } = params;
    return {
        subject: 'First bid placed on your product — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>First Bid Placed</title>
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
    .info-box { background: #f0fdf4; border-left: 4px solid #11998e;
                border-radius: 4px; padding: 14px 18px; margin: 0 0 24px; }
    .info-box .label { font-size: 12px; color: #6b7280; text-transform: uppercase;
                       letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-box .value { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .cta { display: block; width: fit-content; margin: 28px auto;
           padding: 14px 36px;
           background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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
      <p>Hello, ${sellerName}!</p>
      <span class="badge">Auction Live ✓</span>
      <p>Great news — your auction has received its first bid and is now <strong>live</strong>!</p>
      <p><strong>${productTitle}</strong></p>
      <div class="info-box">
        <div class="label">Opening Bid</div>
        <div class="value">${(0, mail_format_util_1.formatCurrency)(bidAmount)}</div>
      </div>
      <div class="info-box">
        <div class="label">Bidding Closes</div>
        <div class="value">${(0, mail_format_util_1.formatDateTime)(biddingEndsAt)}</div>
      </div>
      <p>You will receive another notification when the auction closes. No action needed from you right now.</p>
      <a href="${auctionUrl}" class="cta">View Auction</a>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=bid-placed-seller.template.js.map