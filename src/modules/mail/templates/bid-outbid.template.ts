import { formatCurrency, formatDateTime } from '../utils/mail-format.util';

export interface BidOutbidTemplateParams {
  bidderName: string;
  productTitle: string;
  yourBidAmount: number | string;
  newHighestBid: number | string;
  biddingEndsAt: Date;
  auctionUrl: string;
}

export function bidOutbidTemplate(params: BidOutbidTemplateParams): {
  subject: string;
  html: string;
} {
  const {
    bidderName,
    productTitle,
    yourBidAmount,
    newHighestBid,
    biddingEndsAt,
    auctionUrl,
  } = params;
  return {
    subject: "You've been outbid — BidsBazar",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've Been Outbid</title>
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
    .bid-row { display: flex; justify-content: space-between; padding: 12px 0;
               border-bottom: 1px solid #f0f0f5; font-size: 15px; }
    .bid-row:last-child { border-bottom: none; }
    .bid-row .label { color: #6b7280; }
    .bid-row .amount-old { color: #9ca3af; text-decoration: line-through; }
    .bid-row .amount-new { color: #dc2626; font-weight: 700; }
    .deadline { background: #fff7ed; border-left: 4px solid #f97316;
                border-radius: 4px; padding: 12px 16px; margin: 20px 0;
                font-size: 14px; color: #9a3412; }
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
      <span class="badge">Outbid</span>
      <p>Someone placed a higher bid on <strong>${productTitle}</strong>. You're no longer in the lead.</p>
      <div class="bid-row">
        <span class="label">Your bid</span>
        <span class="amount-old">${formatCurrency(yourBidAmount)}</span>
      </div>
      <div class="bid-row">
        <span class="label">New highest bid</span>
        <span class="amount-new">${formatCurrency(newHighestBid)}</span>
      </div>
      <div class="deadline">
        ⏰ Bidding closes: <strong>${formatDateTime(biddingEndsAt)}</strong>
      </div>
      <p>Place a new bid before the timer runs out to get back in the lead!</p>
      <a href="${auctionUrl}" class="cta">Place New Bid</a>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.</div>
  </div>
</body>
</html>`,
  };
}
