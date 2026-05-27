"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailChangeVerificationTemplate = emailChangeVerificationTemplate;
function emailChangeVerificationTemplate(userName, verificationLink, expiresInHours) {
    return {
        subject: 'Verify your new email address — BidsBazar',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your new email</title>
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
    .cta { display: block; width: fit-content; margin: 28px auto;
           padding: 14px 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
           color: #ffffff !important; text-decoration: none; border-radius: 8px;
           font-size: 16px; font-weight: 600; letter-spacing: 0.2px; }
    .expiry { font-size: 13px; color: #9999aa; text-align: center;
              margin-top: 8px; }
    .notice { font-size: 13px; color: #9999aa; margin-top: 24px; }
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
        You requested to change your BidsBazar email address to this one.
        Click the button below to confirm the change:
      </p>
      <a href="${verificationLink}" class="cta">Verify New Email</a>
      <p class="expiry">This link expires in <strong>${expiresInHours} hour${expiresInHours === 1 ? '' : 's'}</strong>.</p>
      <p class="notice">
        If you did not request this change, you can safely ignore this email.
        Your current email address will remain unchanged.
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
//# sourceMappingURL=email-change-verification.template.js.map