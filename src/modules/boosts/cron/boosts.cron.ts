import { PaymentStatus } from '@common/enums/payment-status.enum';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BoostPayment } from '../entities/boost-payment.entity';
import { BoostsService } from '../services/boosts.service';

// How often to scan for overdue BoostPayment rows (every 10 minutes)
const BOOST_PAYMENTS_EXPIRY_CRON = '*/10 * * * *';
// How often to flip ended ACTIVE boost items to EXPIRED (every 15 minutes)
const BOOST_ITEMS_EXPIRY_CRON = '*/15 * * * *';

@Injectable()
export class BoostsCron {
  private readonly logger = new Logger(BoostsCron.name);

  constructor(
    @InjectRepository(BoostPayment)
    private readonly boostPaymentRepo: Repository<BoostPayment>,
    private readonly boostsService: BoostsService,
  ) {}

  /**
   * Mark PENDING Fonepay BoostPayment rows EXPIRED (and cancel their
   * BoostItem) once their payment window passes. Idempotent — safe to run
   * repeatedly for the same payment.
   */
  @Cron(BOOST_PAYMENTS_EXPIRY_CRON)
  async expireOverdueBoostPayments(): Promise<void> {
    const now = new Date();

    const overduePayments = await this.boostPaymentRepo.find({
      where: {
        status: PaymentStatus.PENDING,
        paymentDeadline: LessThan(now),
      },
    });

    if (overduePayments.length === 0) return;

    this.logger.log(
      `expireOverdueBoostPayments: found ${overduePayments.length} overdue PENDING boost payment(s)`,
    );

    let expired = 0;
    let errors = 0;

    for (const payment of overduePayments) {
      try {
        await this.boostsService.expireBoostPayment(payment.id);
        expired++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `expireOverdueBoostPayments: failed to expire boost payment ${payment.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log(
      `expireOverdueBoostPayments: expired=${expired} errors=${errors}`,
    );
  }

  /**
   * Flip ACTIVE boost items whose window has ended to EXPIRED — frees the
   * product up for a new boost purchase (see BoostItem's partial unique index).
   */
  @Cron(BOOST_ITEMS_EXPIRY_CRON)
  async expireEndedBoosts(): Promise<void> {
    const affected = await this.boostsService.expireEndedBoosts();
    if (affected > 0) {
      this.logger.log(`expireEndedBoosts: expired ${affected} boost item(s)`);
    }
  }
}
