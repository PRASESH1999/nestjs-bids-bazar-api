import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { Payment } from '../entities/payment.entity';
import { PaymentsService } from '../services/payments.service';

// How often to scan for overdue Payment rows (every 10 minutes)
const PAYMENTS_EXPIRY_CRON = '*/10 * * * *';

@Injectable()
export class PaymentsCron {
  private readonly logger = new Logger(PaymentsCron.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Mark PENDING Fonepay Payment rows EXPIRED when their payment window passes.
   *
   * This is complementary to AuctionLifecycleCron.expireOverduePayments() which
   * handles the Bid-level promotion (next winner selection). That cron also emits
   * the WIN_TRANSFERRED event via AuctionLifecycleService.handlePaymentExpiry().
   *
   * This cron only updates the Payment table and closes any stale sockets.
   * It is idempotent — running it multiple times for the same payment is safe.
   */
  @Cron(PAYMENTS_EXPIRY_CRON)
  async expireOverduePayments(): Promise<void> {
    const now = new Date();

    const overduePayments = await this.paymentRepo.find({
      where: {
        status: PaymentStatus.PENDING,
        paymentDeadline: LessThan(now),
      },
    });

    if (overduePayments.length === 0) return;

    this.logger.log(
      `expireOverduePayments: found ${overduePayments.length} overdue PENDING payment(s)`,
    );

    let expired = 0;
    let errors = 0;

    for (const payment of overduePayments) {
      try {
        await this.paymentsService.expirePayment(payment.id);
        expired++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `expireOverduePayments: failed to expire payment ${payment.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log(
      `expireOverduePayments: expired=${expired} errors=${errors}`,
    );
  }
}
