"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auctionAbandonedTemplate = auctionAbandonedTemplate;
function auctionAbandonedTemplate(params) {
    const { sellerName, productTitle, totalBidders } = params;
    return {
        subject: 'Your auction was abandoned — All bidders failed to pay — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Auction Abandoned</title>
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
    .stat-box { background: #fef2f2; border-radius: 8px; padding: 18px 20px;
                margin: 0 0 24px; text-align: center; }
    .stat-box .stat-label { font-size: 12px; color: #9ca3af; text-transform: uppercase;
                             letter-spacing: 0.5px; margin-bottom: 6px; }
    .stat-box .stat-value { font-size: 28px; font-weight: 700; color: #dc2626; }
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
      <p>Hello, ${sellerName},</p>
      <span class="badge">Auction Abandoned</span>
      <p>
        We're sorry to inform you that the auction for <strong>${productTitle}</strong>
        has been abandoned. All ${totalBidders} bidder${totalBidders === 1 ? '' : 's'} in
        the payment chain failed to complete payment within their respective windows.
      </p>
      <div class="stat-box">
        <div class="stat-label">Bidders who failed to pay</div>
        <div class="stat-value">${totalBidders}</div>
      </div>
      <p>Your product is currently in <strong>ABANDONED</strong> status.</p>
      <div class="info-box">
        You may relist this product as a new auction. Please contact our support team
        if you need assistance or have questions about your options.
      </div>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=auction-abandoned.template.js.map