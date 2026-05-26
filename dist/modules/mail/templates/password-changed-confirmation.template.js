"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordChangedConfirmationTemplate = passwordChangedConfirmationTemplate;
function passwordChangedConfirmationTemplate(userName, changedAt, supportEmail) {
    return {
        subject: 'Your password was changed — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password changed</title>
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
    .body p { margin: 0 0 20px; font-size: 15px; line-height: 1.7;
              color: #4a4a6a; }
    .badge { display: inline-block; padding: 6px 16px; background: #d1fae5;
             color: #065f46; border-radius: 20px; font-size: 13px;
             font-weight: 600; margin-bottom: 24px; }
    .timestamp { font-size: 13px; color: #9999aa; }
    .warning { background: #fff7ed; border-left: 4px solid #f97316;
               padding: 16px 20px; border-radius: 6px; margin-top: 24px; }
    .warning p { margin: 0; font-size: 14px; color: #7c3f00; }
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
      <p>Hello, ${userName}!</p>
      <span class="badge">Password Changed ✓</span>
      <p>
        The password for your BidsBazar account was successfully changed.
      </p>
      <p class="timestamp">Changed at: <strong>${changedAt}</strong></p>
      <div class="warning">
        <p>
          <strong>If this wasn't you</strong>, contact our support team immediately at
          <a href="mailto:${supportEmail}" style="color: #c2410c;">${supportEmail}</a>
          so we can secure your account.
        </p>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidsBazar. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    };
}
//# sourceMappingURL=password-changed-confirmation.template.js.map