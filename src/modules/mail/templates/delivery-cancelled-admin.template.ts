export interface DeliveryCancelledAdminTemplateParams {
  productTitle: string;
  deliveryId: string;
  consignmentId: string;
  orderStatus: string;
  buyerUsername: string | null;
}

/**
 * Internal ops alert, sent to the support mailbox (MAIL_FROM) — there is no
 * admin notification channel in the app. A cancelled Pathao order sits in the
 * CANCELLED queue until an admin redispatches it, so somebody has to be told.
 */
export function deliveryCancelledAdminTemplate(
  params: DeliveryCancelledAdminTemplateParams,
): { subject: string; html: string } {
  const {
    productTitle,
    deliveryId,
    consignmentId,
    orderStatus,
    buyerUsername,
  } = params;
  return {
    subject: `Pathao order cancelled — redispatch needed: ${productTitle} — BidsBazar`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Courier Order Cancelled</title>
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
    .summary-row { padding: 10px 0; border-bottom: 1px solid #f0f0f5;
                   font-size: 14px; }
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
      <span class="badge">Courier order cancelled</span>
      <p>
        Pathao reports the courier order for <strong>${productTitle}</strong> as
        cancelled. The parcel is in the <strong>Cancelled</strong> delivery queue and
        needs a redispatch from the admin panel. The buyer has been told we are
        rebooking it.
      </p>
      <div class="summary-row"><span class="label">Consignment:</span> <span class="value">${consignmentId}</span></div>
      <div class="summary-row"><span class="label">Pathao status:</span> <span class="value">${orderStatus}</span></div>
      <div class="summary-row"><span class="label">Buyer:</span> <span class="value">${buyerUsername ?? 'Unknown'}</span></div>
      <div class="summary-row"><span class="label">Delivery id:</span> <span class="value">${deliveryId}</span></div>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BidsBazar. Internal operations alert.</div>
  </div>
</body>
</html>`,
  };
}
