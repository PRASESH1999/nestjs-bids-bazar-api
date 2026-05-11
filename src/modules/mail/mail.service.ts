import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { kycApprovedTemplate } from './templates/kyc-approved.template';
import { kycReceivedTemplate } from './templates/kyc-received.template';
import { kycRejectedTemplate } from './templates/kyc-rejected.template';
import { verifyEmailTemplate } from './templates/verify-email.template';
import { productSubmittedTemplate } from './templates/product-submitted.template';
import { productApprovedTemplate } from './templates/product-approved.template';
import { productRejectedTemplate } from './templates/product-rejected.template';
import { bidPlacedSellerTemplate } from './templates/bid-placed-seller.template';
import { bidOutbidTemplate } from './templates/bid-outbid.template';
import { auctionWonTemplate } from './templates/auction-won.template';
import { auctionClosedSellerTemplate } from './templates/auction-closed-seller.template';
import { paymentWindowExpiringTemplate } from './templates/payment-window-expiring.template';
import { paymentFailedFallbackTemplate } from './templates/payment-failed-fallback.template';
import { paymentFailedSellerTemplate } from './templates/payment-failed-seller.template';
import { paymentConfirmedSellerTemplate } from './templates/payment-confirmed-seller.template';
import { paymentConfirmedBuyerTemplate } from './templates/payment-confirmed-buyer.template';
import { auctionAbandonedTemplate } from './templates/auction-abandoned.template';

/**
 * Global mail service that wraps nodemailer for all transactional emails.
 * Templates are plain functions — no external engine required.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAIL_HOST'),
      port: this.configService.getOrThrow<number>('MAIL_PORT'),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true', // false for 587
      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USER'),
        pass: this.configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
      tls: {
        // Do not fail on invalid certs (common in dev)
        rejectUnauthorized: false,
      },
    });

    // Verify connection on startup
    try {
      await this.transporter.verify();
      this.logger.log('SMTP Connection verified successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP Connection failed: ${message}`);
    }
  }

  /**
   * Send the email verification link.
   * The raw token is embedded in the link — never logged.
   */
  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
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
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const sellingUrl = `${frontendUrl}/sell`;
    const { subject, html } = kycApprovedTemplate(name, sellingUrl);
    await this.send(to, subject, html);
    this.logger.log('KYC approved email dispatched', { to });
  }

  /**
   * Notify a user that their KYC has been rejected with the reason.
   */
  async sendKycRejected(
    to: string,
    name: string,
    reason: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const resubmitUrl = `${frontendUrl}/kyc/submit`;
    const { subject, html } = kycRejectedTemplate(name, reason, resubmitUrl);
    await this.send(to, subject, html);
    this.logger.log('KYC rejected email dispatched', { to });
  }

  /** Notify the product owner that their listing is under admin review. */
  async sendProductSubmitted(
    to: string,
    name: string,
    productTitle: string,
  ): Promise<void> {
    const { subject, html } = productSubmittedTemplate(name, productTitle);
    await this.send(to, subject, html);
    this.logger.log('Product submitted email dispatched', { to });
  }

  /** Notify the product owner that their listing has been approved and is live. */
  async sendProductApproved(
    to: string,
    name: string,
    productTitle: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const listingUrl = `${frontendUrl}/products`;
    const { subject, html } = productApprovedTemplate(
      name,
      productTitle,
      listingUrl,
    );
    await this.send(to, subject, html);
    this.logger.log('Product approved email dispatched', { to });
  }

  /** Notify the product owner that their listing was rejected, with the reason. */
  async sendProductRejected(
    to: string,
    name: string,
    productTitle: string,
    reason: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const resubmitUrl = `${frontendUrl}/products/me`;
    const { subject, html } = productRejectedTemplate(
      name,
      productTitle,
      reason,
      resubmitUrl,
    );
    await this.send(to, subject, html);
    this.logger.log('Product rejected email dispatched', { to });
  }

  // ─── Bidding lifecycle emails ─────────────────────────────────────────────

  /** Notify the seller that the first bid has been placed and the auction is live. */
  async sendBidPlacedSeller(
    to: string,
    params: {
      sellerName: string;
      productTitle: string;
      bidAmount: number | string;
      biddingEndsAt: Date;
      productId: string;
    },
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const auctionUrl = `${frontendUrl}/products/${params.productId}`;
    const { subject, html } = bidPlacedSellerTemplate({
      sellerName: params.sellerName,
      productTitle: params.productTitle,
      bidAmount: params.bidAmount,
      biddingEndsAt: params.biddingEndsAt,
      auctionUrl,
    });
    await this.send(to, subject, html);
    this.logger.log('Bid placed (seller) email dispatched', { to });
  }

  /** Notify a bidder that they have been outbid. */
  async sendBidOutbid(
    to: string,
    params: {
      bidderName: string;
      productTitle: string;
      yourBidAmount: number | string;
      newHighestBid: number | string;
      biddingEndsAt: Date;
      productId: string;
    },
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const auctionUrl = `${frontendUrl}/products/${params.productId}`;
    const { subject, html } = bidOutbidTemplate({
      bidderName: params.bidderName,
      productTitle: params.productTitle,
      yourBidAmount: params.yourBidAmount,
      newHighestBid: params.newHighestBid,
      biddingEndsAt: params.biddingEndsAt,
      auctionUrl,
    });
    await this.send(to, subject, html);
    this.logger.log('Outbid email dispatched', { to });
  }

  /** Notify the winning bidder that they won and must pay within the deadline. */
  async sendAuctionWon(
    to: string,
    params: {
      bidderName: string;
      productTitle: string;
      productId: string;
      winningAmount: number | string;
      paymentDeadline: Date;
    },
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const paymentUrl = `${frontendUrl}/products/${params.productId}/pay`;
    const { subject, html } = auctionWonTemplate({
      bidderName: params.bidderName,
      productTitle: params.productTitle,
      winningAmount: params.winningAmount,
      paymentDeadline: params.paymentDeadline,
      paymentUrl,
    });
    await this.send(to, subject, html);
    this.logger.log('Auction won email dispatched', { to });
  }

  /** Notify the seller that the auction has closed and show the winner. */
  async sendAuctionClosedSeller(
    to: string,
    params: {
      sellerName: string;
      productTitle: string;
      winningAmount: number | string;
      winnerName: string;
    },
  ): Promise<void> {
    const { subject, html } = auctionClosedSellerTemplate(params);
    await this.send(to, subject, html);
    this.logger.log('Auction closed (seller) email dispatched', { to });
  }

  /**
   * Warn a bidder that their payment window is closing in ~2 hours.
   * Returns true if the email was dispatched successfully, false on failure.
   * Callers use this signal to decide whether to set paymentWarningSentAt.
   */
  async sendPaymentWindowExpiring(
    to: string,
    params: {
      bidderName: string;
      productTitle: string;
      amount: number | string;
      paymentDeadline: Date;
      productId: string;
    },
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const paymentUrl = `${frontendUrl}/products/${params.productId}/pay`;
    const { subject, html } = paymentWindowExpiringTemplate({
      bidderName: params.bidderName,
      productTitle: params.productTitle,
      amount: params.amount,
      paymentDeadline: params.paymentDeadline,
      paymentUrl,
    });
    const sent = await this.trySend(to, subject, html);
    if (sent)
      this.logger.log('Payment window expiring email dispatched', { to });
    return sent;
  }

  /** Notify a fallback bidder that they are now the winning bidder. */
  async sendPaymentFailedFallback(
    to: string,
    params: {
      bidderName: string;
      productTitle: string;
      productId: string;
      winningAmount: number | string;
      paymentDeadline: Date;
      fallbackRank: number;
    },
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('APP_FRONTEND_URL');
    const paymentUrl = `${frontendUrl}/products/${params.productId}/pay`;
    const { subject, html } = paymentFailedFallbackTemplate({
      bidderName: params.bidderName,
      productTitle: params.productTitle,
      winningAmount: params.winningAmount,
      paymentDeadline: params.paymentDeadline,
      fallbackRank: params.fallbackRank,
      paymentUrl,
    });
    await this.send(to, subject, html);
    this.logger.log('Payment failed — fallback winner email dispatched', {
      to,
    });
  }

  /** Notify the seller that a winner failed to pay and the fallback chain advanced. */
  async sendPaymentFailedSeller(
    to: string,
    params: {
      sellerName: string;
      productTitle: string;
      failedBidderRank: number;
      newWinnerName: string;
      newWinnerBidAmount: number | string;
    },
  ): Promise<void> {
    const { subject, html } = paymentFailedSellerTemplate(params);
    await this.send(to, subject, html);
    this.logger.log('Payment failed (seller) email dispatched', { to });
  }

  /** Notify the seller that payment has been confirmed and the auction is settled. */
  async sendPaymentConfirmedSeller(
    to: string,
    params: {
      sellerName: string;
      productTitle: string;
      amount: number | string;
      buyerName: string;
    },
  ): Promise<void> {
    const { subject, html } = paymentConfirmedSellerTemplate(params);
    await this.send(to, subject, html);
    this.logger.log('Payment confirmed (seller) email dispatched', { to });
  }

  /** Notify the buyer that their payment is confirmed and the purchase is complete. */
  async sendPaymentConfirmedBuyer(
    to: string,
    params: {
      buyerName: string;
      productTitle: string;
      amount: number | string;
    },
  ): Promise<void> {
    const { subject, html } = paymentConfirmedBuyerTemplate(params);
    await this.send(to, subject, html);
    this.logger.log('Payment confirmed (buyer) email dispatched', { to });
  }

  /** Notify the seller that all bidders failed to pay and the auction is abandoned. */
  async sendAuctionAbandoned(
    to: string,
    params: {
      sellerName: string;
      productTitle: string;
      totalBidders: number;
    },
  ): Promise<void> {
    const { subject, html } = auctionAbandonedTemplate(params);
    await this.send(to, subject, html);
    this.logger.log('Auction abandoned email dispatched', { to });
  }

  // ─── Internal send helpers ────────────────────────────────────────────────

  /** Sends mail; swallows errors (never throws). Used by most methods. */
  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.configService.getOrThrow<string>('MAIL_FROM');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send email', {
        to,
        subject,
        error: message,
      });
      // Do not rethrow — mail failures must not break the HTTP response
    }
  }

  /**
   * Sends mail and returns true on success, false on failure.
   * Used by sendPaymentWindowExpiring so the cron can decide whether
   * to mark paymentWarningSentAt (only set on confirmed dispatch).
   */
  private async trySend(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const from = this.configService.getOrThrow<string>('MAIL_FROM');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send email', {
        to,
        subject,
        error: message,
      });
      return false;
    }
  }
}
