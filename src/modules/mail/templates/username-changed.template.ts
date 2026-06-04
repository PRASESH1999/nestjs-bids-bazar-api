/** Returns the subject and HTML body for the username-change confirmation email. */
export function usernameChangedTemplate(
  newUsername: string,
  changedAt: string,
): { subject: string; html: string } {
  return {
    subject: 'Your username has been changed — BidsBazar',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Username changed</title>
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
    .handle { display: inline-block; background: #f0f0fb; border-radius: 6px;
              padding: 4px 10px; font-weight: 700; color: #4a4a6a; }
    .notice { background: #fff8e6; border-left: 4px solid #f5a623;
              padding: 14px 18px; border-radius: 6px; font-size: 13px;
              color: #7a5a00; margin-top: 8px; }
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
      <p>Hello!</p>
      <p>
        Your username on BidsBazar was successfully changed to
        <span class="handle">${newUsername}</span> on
        <strong>${changedAt}</strong>.
      </p>
      <p class="notice">
        <strong>Wasn't you?</strong> If you did not make this change,
        please contact our support team immediately.
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
