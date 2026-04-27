"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRejectedTemplate = kycRejectedTemplate;
function kycRejectedTemplate(name, rejectionReason, resubmitUrl) {
    return {
        subject: 'KYC Rejected — Action Required',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KYC Rejected</title>
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
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7;
              color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #fee2e2;
             color: #991b1b; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .reason-box { background: #fef9c3; border-left: 4px solid #f59e0b;
                  border-radius: 4px; padding: 14px 18px; margin: 0 0 24px;
                  font-size: 14px; color: #78350f; line-height: 1.6; }
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
    <div class="header">
      <h1>BidsBazar</h1>
    </div>
    <div class="body">
      <p>Hello, ${name},</p>
      <span class="badge">KYC Rejected</span>
      <p>
        We're sorry — your KYC verification was reviewed and <strong>rejected</strong>.
        Please read the reason below and resubmit your application with the
        required corrections.
      </p>
      <div class="reason-box">
        <strong>Rejection reason:</strong><br />
        ${rejectionReason}
      </div>
      <p>
        Once you have addressed the issue, click the button below to resubmit
        your KYC documents.
      </p>
      <a href="${resubmitUrl}" class="cta">Resubmit KYC</a>
      <p>
        If you believe this decision was made in error, please contact our
        support team.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=kyc-rejected.template.js.map