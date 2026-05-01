/** Sent to the product owner when their listing is rejected by an admin. */
export function productRejectedTemplate(
  name: string,
  productTitle: string,
  rejectionReason: string,
  resubmitUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Your product was rejected — Action Required',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Product Rejected</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif;
           background: #f4f6f8; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff;
               border-radius: 12px; overflow: hidden;
               box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
              padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px;
                 font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #fee2e2;
             color: #991b1b; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .product-title { background: #fff7f7; border-left: 4px solid #f5576c;
                     padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;
                     font-size: 15px; color: #1a1a2e; font-weight: 500; }
    .reason-box { background: #fef2f2; border: 1px solid #fecaca;
                  border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .reason-box p { margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.6; }
    .cta { display: block; width: fit-content; margin: 28px auto;
           padding: 14px 36px;
           background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
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
      <p>Hi ${name},</p>
      <span class="badge">Listing Rejected</span>
      <p>Unfortunately, your product listing was <strong>not approved</strong>:</p>
      <div class="product-title">${productTitle}</div>
      <p><strong>Reason for rejection:</strong></p>
      <div class="reason-box">
        <p>${rejectionReason}</p>
      </div>
      <p>
        Please review the feedback above, make the necessary changes to your
        listing, and resubmit for approval.
      </p>
      <a href="${resubmitUrl}" class="cta">Edit &amp; Resubmit</a>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.
    </div>
  </div>
</body>
</html>`,
  };
}
