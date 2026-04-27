import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { kycApprovedTemplate } from './templates/kyc-approved.template';
import { kycReceivedTemplate } from './templates/kyc-received.template';
import { kycRejectedTemplate } from './templates/kyc-rejected.template';
import { verifyEmailTemplate } from './templates/verify-email.template';

/**
 * Global mail service that wraps nodemailer for all transactional emails.
 * Templates are plain functions — no external engine required.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAIL_HOST'),
      port: this.configService.getOrThrow<number>('MAIL_PORT'),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USER'),
        pass: this.configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });
  }

  /**
   * Send the email verification link.
   * The raw token is embedded in the link — never logged.
   */
  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${rawToken}`;
    const { subject, html } = verifyEmailTemplate(verificationUrl);
    await this.send(to, subject, html);
    this.logger.log('Verification email dispatched', { to });
  }

  /**
   * Notify a user that their KYC submission has been received and is under review.
   */
  async sendKycReceived(to: string, name: string): Promise<void> {
    const { subject, html } = kycReceivedTemplate(name);
    await this.send(to, subject, html);
    this.logger.log('KYC received email dispatched', { to });
  }

  /**
   * Notify a user that their KYC has been approved and they can now sell.
   */
  async sendKycApproved(to: string, name: string): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const sellingUrl = `${frontendUrl}/sell`;
    const { subject, html } = kycApprovedTemplate(name, sellingUrl);
    await this.send(to, subject, html);
    this.logger.log('KYC approved email dispatched', { to });
  }

  /**
   * Notify a user that their KYC has been rejected with the reason.
   */
  async sendKycRejected(to: string, name: string, reason: string): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const resubmitUrl = `${frontendUrl}/kyc/submit`;
    const { subject, html } = kycRejectedTemplate(name, reason, resubmitUrl);
    await this.send(to, subject, html);
    this.logger.log('KYC rejected email dispatched', { to });
  }

  /** Internal send helper — centralises the from address and error handling. */
  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.configService.getOrThrow<string>('MAIL_FROM');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send email', { to, subject, error: message });
      // Do not rethrow — mail failures must not break the HTTP response
    }
  }
}
