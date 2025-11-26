// Enhanced SMTP Email Service with Multi-Provider Support
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface InvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteToken: string;
  expiresAt: Date;
}

// SMTP Configuration Types
type SMTPProvider = 'gmail' | 'outlook' | 'sendgrid' | 'ses' | 'custom';

interface SMTPConfig {
  provider: SMTPProvider;
  host?: string;
  port?: number;
  secure?: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
}

class EnhancedEmailService {
  private transporter: Transporter | null = null;
  private sesClient: SESClient | null = null;
  private provider: SMTPProvider | null = null;
  private fromEmail: string = 'noreply@investmentbank-crm.com';

  constructor() {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    // Priority 1: Check for Nodemailer SMTP configuration
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.initializeSMTP();
      return;
    }

    // Priority 2: Check for provider-specific configurations
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.initializeGmail();
      return;
    }

    if (process.env.OUTLOOK_USER && process.env.OUTLOOK_PASSWORD) {
      this.initializeOutlook();
      return;
    }

    if (process.env.SENDGRID_API_KEY) {
      this.initializeSendGrid();
      return;
    }

    // Priority 3: AWS SES (existing integration)
    if (this.isAWSSESConfigured()) {
      this.initializeAWSSES();
      return;
    }

    console.warn('⚠️  No email service configured - emails will not be sent');
    console.warn('Configure one of the following:');
    console.warn('  • SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL');
    console.warn('  • Gmail: GMAIL_USER, GMAIL_APP_PASSWORD');
    console.warn('  • Outlook: OUTLOOK_USER, OUTLOOK_PASSWORD');
    console.warn('  • SendGrid: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL');
    console.warn('  • AWS SES: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_SES_FROM_EMAIL');
  }

  private initializeSMTP() {
    try {
      const config: SMTPConfig = {
        provider: 'custom',
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      };

      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });

      this.provider = 'custom';
      this.fromEmail = process.env.SMTP_FROM_EMAIL || this.fromEmail;
      console.log(`✅ SMTP email service initialized: ${config.host}:${config.port}`);
    } catch (error) {
      console.error('❌ Failed to initialize SMTP:', error);
    }
  }

  private initializeGmail() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER!,
          pass: process.env.GMAIL_APP_PASSWORD!, // App password, not regular password
        },
      });

      this.provider = 'gmail';
      this.fromEmail = process.env.GMAIL_USER!;
      console.log(`✅ Gmail email service initialized: ${this.fromEmail}`);
    } catch (error) {
      console.error('❌ Failed to initialize Gmail:', error);
    }
  }

  private initializeOutlook() {
    try {
      this.transporter = nodemailer.createTransport({
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.OUTLOOK_USER!,
          pass: process.env.OUTLOOK_PASSWORD!,
        },
      });

      this.provider = 'outlook';
      this.fromEmail = process.env.OUTLOOK_USER!;
      console.log(`✅ Outlook email service initialized: ${this.fromEmail}`);
    } catch (error) {
      console.error('❌ Failed to initialize Outlook:', error);
    }
  }

  private initializeSendGrid() {
    try {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY!,
        },
      });

      this.provider = 'sendgrid';
      this.fromEmail = process.env.SENDGRID_FROM_EMAIL || this.fromEmail;
      console.log(`✅ SendGrid email service initialized: ${this.fromEmail}`);
    } catch (error) {
      console.error('❌ Failed to initialize SendGrid:', error);
    }
  }

  private isAWSSESConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID && 
      process.env.AWS_SECRET_ACCESS_KEY && 
      process.env.AWS_REGION &&
      process.env.AWS_SES_FROM_EMAIL
    );
  }

  private initializeAWSSES() {
    try {
      this.sesClient = new SESClient({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      this.provider = 'ses';
      this.fromEmail = process.env.AWS_SES_FROM_EMAIL!;
      console.log(`✅ AWS SES email service initialized in region: ${process.env.AWS_REGION}`);
    } catch (error) {
      console.error('❌ Failed to initialize AWS SES:', error);
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    const fromEmail = params.from || this.fromEmail;

    // Try SMTP first (Nodemailer)
    if (this.transporter) {
      return this.sendViaSMTP({ ...params, from: fromEmail });
    }

    // Fallback to AWS SES
    if (this.sesClient && this.provider === 'ses') {
      return this.sendViaSES({ ...params, from: fromEmail });
    }

    // No email service configured
    console.log('📧 Email sending skipped - no service configured');
    console.log(`Would have sent to: ${params.to}, subject: ${params.subject}`);
    return {
      success: false,
      error: 'No email service configured',
      provider: 'none',
    };
  }

  private async sendViaSMTP(params: EmailParams): Promise<EmailResult> {
    try {
      if (!this.transporter) {
        throw new Error('SMTP transporter not initialized');
      }

      const info = await this.transporter.sendMail({
        from: params.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      console.log(`✅ Email sent via ${this.provider}: ${params.to} (${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        provider: this.provider || 'smtp',
      };
    } catch (error: any) {
      console.error(`❌ SMTP email error (${this.provider}):`, error);
      return {
        success: false,
        error: error.message || 'Unknown SMTP error',
        provider: this.provider || 'smtp',
      };
    }
  }

  private async sendViaSES(params: EmailParams): Promise<EmailResult> {
    try {
      if (!this.sesClient) {
        throw new Error('SES client not initialized');
      }

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

      const response = await this.sesClient.send(command);
      console.log(`✅ Email sent via AWS SES: ${params.to} (${response.MessageId})`);
      return {
        success: true,
        messageId: response.MessageId,
        provider: 'ses',
      };
    } catch (error: any) {
      console.error('❌ AWS SES email error:', error);
      return {
        success: false,
        error: error.message || 'Unknown SES error',
        provider: 'ses',
      };
    }
  }

  async sendInvitationEmail(params: InvitationEmailParams): Promise<EmailResult> {
    const inviteUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://your-domain.replit.app'}/api/login`;
    const expiresAtFormatted = params.expiresAt.toLocaleDateString('en-US', {
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
            <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> as a <strong>${params.role}</strong> in our Investment Bank CRM system.</p>
            
            <div class="info-box">
              <strong>Your Role:</strong> ${params.role.charAt(0).toUpperCase() + params.role.slice(1)}<br>
              <strong>Organization:</strong> ${params.organizationName}<br>
              <strong>Invited by:</strong> ${params.inviterName}
            </div>

            <p>Click the button below to sign in and accept your invitation:</p>
            <a href="${inviteUrl}" class="button">Sign In to Accept</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">${inviteUrl}</p>
            
            <p><strong>Important:</strong> This invitation expires on ${expiresAtFormatted}.</p>
            
            <p>Once you sign in, your invitation will be automatically accepted and you'll have access to the CRM system.</p>
            
            <p>If you have any questions, please contact your administrator.</p>
          </div>
          <div class="footer">
            <p>This invitation was sent to ${params.recipientEmail}. If you weren't expecting this email, you can safely ignore it.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Investment Bank CRM Invitation

Hi there,

${params.inviterName} has invited you to join ${params.organizationName} as a ${params.role} in our Investment Bank CRM system.

Your Role: ${params.role.charAt(0).toUpperCase() + params.role.slice(1)}
Organization: ${params.organizationName}
Invited by: ${params.inviterName}

To accept your invitation, sign in here: ${inviteUrl}

This invitation expires on ${expiresAtFormatted}.

Once you sign in, your invitation will be automatically accepted and you'll have access to the CRM system.

If you have any questions, please contact your administrator.

This invitation was sent to ${params.recipientEmail}. If you weren't expecting this email, you can safely ignore it.
    `;

    return await this.sendEmail({
      to: params.recipientEmail,
      subject: `You're invited to join ${params.organizationName} - Investment Bank CRM`,
      text: textContent,
      html: htmlContent,
    });
  }

  // Test email configuration
  async testEmailConfig(): Promise<EmailResult> {
    return await this.sendEmail({
      to: this.fromEmail,
      subject: 'Investment Bank CRM - Email Configuration Test',
      text: 'This is a test email to verify your email configuration is working correctly.',
      html: '<p>This is a test email to verify your email configuration is working correctly.</p>',
    });
  }

  getConfigStatus() {
    return {
      configured: !!(this.transporter || this.sesClient),
      provider: this.provider,
      fromEmail: this.fromEmail,
    };
  }
}

// Export singleton instance
export const emailService = new EnhancedEmailService();

// Export for backward compatibility
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<boolean> {
  const result = await emailService.sendInvitationEmail(params);
  return result.success;
}
