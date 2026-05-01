/** Sent to the product owner when they submit their listing for admin review. */
export function productSubmittedTemplate(
  name: string,
  productTitle: string,
): { subject: string; html: string } {
  return {
    subject: 'Your product is under review — BidsBazar',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Product Under Review</title>
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
    .product-title { background: #f8f7ff; border-left: 4px solid #764ba2;
                     padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;
                     font-size: 15px; color: #1a1a2e; font-weight: 500; }
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
      <p>Hi ${name},</p>
      <span class="badge">Under Review</span>
      <p>Your product listing has been submitted and is now awaiting admin review:</p>
      <div class="product-title">${productTitle}</div>
      <p>
        Our team will review your listing within 24–48 hours. You will receive
        an email once a decision has been made.
      </p>
      <p>Thank you for listing on BidsBazar!</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.
    </div>
  </div>
</body>
</html>`,
  };
}
