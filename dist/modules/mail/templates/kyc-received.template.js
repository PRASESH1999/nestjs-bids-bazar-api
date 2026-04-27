"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycReceivedTemplate = kycReceivedTemplate;
function kycReceivedTemplate(name) {
    return {
        subject: 'KYC Submission Received — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KYC Submission Received</title>
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
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7;
              color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #fff4e5;
             color: #d97706; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
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
      <span class="badge">Under Review</span>
      <p>
        Thank you for submitting your KYC verification. We have received your documents
        and our team is currently reviewing your application.
      </p>
      <p>
        You will be notified via email once a decision has been made. This usually takes
        1–3 business days.
      </p>
      <p>
        If you have any questions, feel free to contact our support team.
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
//# sourceMappingURL=kyc-received.template.js.map