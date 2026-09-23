import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProductDeliveriesService } from '../services/product-deliveries.service';

// How often to poll Pathao for dispatched-but-not-delivered deliveries.
const STATUS_SYNC_CRON = '*/15 * * * *';

@Injectable()
export class ProductDeliveriesCron {
  private readonly logger = new Logger(ProductDeliveriesCron.name);

  constructor(
    private readonly productDeliveriesService: ProductDeliveriesService,
  ) {}

  @Cron(STATUS_SYNC_CRON)
  async syncInFlightDeliveries(): Promise<void> {
    const deliveries =
      await this.productDeliveriesService.findDispatchedNotDelivered();
    if (deliveries.length === 0) return;

    this.logger.log(
      `syncInFlightDeliveries: checking ${deliveries.length} in-flight delivery(ies)`,
    );

    let updated = 0;
    let errors = 0;

    for (const delivery of deliveries) {
      try {
        await this.productDeliveriesService.refreshStatus(delivery);
        updated++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `syncInFlightDeliveries: failed to refresh delivery ${delivery.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log(
      `syncInFlightDeliveries: updated=${updated} errors=${errors}`,
    );
  }
}
