"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailChangedOldAddressTemplate = emailChangedOldAddressTemplate;
function emailChangedOldAddressTemplate(userName, newEmail, changedAt) {
    return {
        subject: 'Your email address has been changed — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email address changed</title>
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
    .highlight { font-weight: 600; color: #1a1a2e; }
    .notice { background: #fff0f0; border-left: 4px solid #e74c3c;
              padding: 14px 18px; border-radius: 6px; font-size: 13px;
              color: #7a0000; margin-top: 8px; }
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
      <p>
        The email address associated with your BidsBazar account was changed
        on <strong>${changedAt}</strong> to:
        <span class="highlight">${newEmail}</span>
      </p>
      <p>
        Future login attempts and notifications will use your new email address.
      </p>
      <p class="notice">
        <strong>Wasn't you?</strong> If you did not make this change,
        please contact our support team immediately to secure your account.
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
//# sourceMappingURL=email-changed-old-address.template.js.map