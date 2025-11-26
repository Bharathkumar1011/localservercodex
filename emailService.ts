// AWS SES Email Service Integration
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Check if AWS SES is properly configured
const AWS_SES_ENABLED = !!(
  process.env.AWS_ACCESS_KEY_ID && 
  process.env.AWS_SECRET_ACCESS_KEY && 
  process.env.AWS_REGION &&
  process.env.AWS_SES_FROM_EMAIL
);

let sesClient: SESClient | null = null;
if (AWS_SES_ENABLED) {
  sesClient = new SESClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  console.log(`AWS SES email service initialized in region: ${process.env.AWS_REGION}`);
} else {
  console.warn('AWS SES credentials not found - email sending will be disabled');
  console.warn('Required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_SES_FROM_EMAIL');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!AWS_SES_ENABLED || !sesClient) {
    console.log('Email sending skipped - AWS SES not configured');
    console.log(`Would have sent email to: ${params.to}, subject: ${params.subject}`);
    return false; // Return false to indicate email wasn't sent, but don't crash
  }

  try {
    const command = new SendEmailCommand({
      Source: params.from,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {
          ...(params.text && {
            Text: {
              Data: params.text,
              Charset: 'UTF-8',
            },
          }),
          ...(params.html && {
            Html: {
              Data: params.html,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    await sesClient.send(command);
    console.log(`Email sent successfully via AWS SES to: ${params.to}`);
    return true;
  } catch (error) {
    console.error('AWS SES email error:', error);
    return false;
  }
}

export interface InvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteToken: string;
  expiresAt: Date;
}

export async function sendInvitationEmail({
  recipientEmail,
  inviterName,
  organizationName,
  role,
  inviteToken,
  expiresAt,
}: InvitationEmailParams): Promise<boolean> {
  const inviteUrl = `${process.env.REPLIT_DOMAINS}/invitation/accept?token=${inviteToken}`;
  const expiresAtFormatted = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Investment Bank CRM Invitation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e1e5e9; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #5a6fd8; }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { color: #6c757d; font-size: 14px; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Investment Bank CRM</h1>
          <p>You've been invited to join our team</p>
        </div>
        <div class="content">
          <h2>Welcome to the team!</h2>
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong> in our Investment Bank CRM system.</p>
          
          <div class="info-box">
            <strong>Your Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}<br>
            <strong>Organization:</strong> ${organizationName}<br>
            <strong>Invited by:</strong> ${inviterName}
          </div>

          <p>Click the button below to accept your invitation and get started:</p>
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">${inviteUrl}</p>
          
          <p><strong>Important:</strong> This invitation expires on ${expiresAtFormatted}.</p>
          
          <p>Once you accept the invitation, you'll be able to access the CRM system and start managing deal pipelines, tracking leads, and collaborating with your team.</p>
          
          <p>If you have any questions, please contact your administrator.</p>
        </div>
        <div class="footer">
          <p>This invitation was sent to ${recipientEmail}. If you weren't expecting this email, you can safely ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Investment Bank CRM Invitation

Hi there,

${inviterName} has invited you to join ${organizationName} as a ${role} in our Investment Bank CRM system.

Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
Organization: ${organizationName}
Invited by: ${inviterName}

To accept your invitation, visit: ${inviteUrl}

This invitation expires on ${expiresAtFormatted}.

Once you accept the invitation, you'll be able to access the CRM system and start managing deal pipelines, tracking leads, and collaborating with your team.

If you have any questions, please contact your administrator.

This invitation was sent to ${recipientEmail}. If you weren't expecting this email, you can safely ignore it.
  `;

  return await sendEmail({
    to: recipientEmail,
    from: process.env.AWS_SES_FROM_EMAIL || 'noreply@investmentbank-crm.com',
    subject: `You're invited to join ${organizationName} - Investment Bank CRM`,
    text: textContent,
    html: htmlContent,
  });
}