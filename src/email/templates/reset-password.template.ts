// src/email/templates/reset-password.template.ts
// HTML email template for password reset

export function getResetPasswordEmailHtml(
  resetUrl: string,
  displayName?: string,
): string {
  const name = displayName || 'there';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
          <tr>
            <td align="center">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f97316;">
                RAG Scientific
              </h1>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px;">
          <tr>
            <td>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827;">
                Reset your password
              </h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                Hi ${name}, we received a request to reset your password. Click the button below to create a new password.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #f97316;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #6b7280;">
                This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <!-- Fallback URL -->
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af; word-break: break-all;">
                If the button doesn't work, copy and paste this URL into your browser:<br/>
                <a href="${resetUrl}" style="color: #f97316; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} RAG Scientific. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getResetPasswordEmailText(
  resetUrl: string,
  displayName?: string,
): string {
  const name = displayName || 'there';
  return `Hi ${name},

We received a request to reset your password for your RAG Scientific account.

Reset your password by visiting: ${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

- RAG Scientific Team`;
}
