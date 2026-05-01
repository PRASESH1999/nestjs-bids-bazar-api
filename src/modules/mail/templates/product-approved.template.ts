/** Sent to the product owner when their listing is approved and goes live. */
export function productApprovedTemplate(
  name: string,
  productTitle: string,
  listingUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Your product is now listed — BidsBazar',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Product Approved</title>
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
    .product-title { background: #f0fdf4; border-left: 4px solid #11998e;
                     padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;
                     font-size: 15px; color: #1a1a2e; font-weight: 500; }
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
    <div class="header">
      <h1>BidsBazar</h1>
    </div>
    <div class="body">
      <p>Congratulations, ${name}!</p>
      <span class="badge">Listing Approved ✓</span>
      <p>Your product listing has been <strong>approved</strong> and is now live:</p>
      <div class="product-title">${productTitle}</div>
      <p>
        Buyers can now view your listing and place bids. You will be notified
        when bidding activity begins.
      </p>
      <a href="${listingUrl}" class="cta">View Your Listing</a>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.
    </div>
  </div>
</body>
</html>`,
  };
}
