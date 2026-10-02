import { DeliveryStage } from './dto/delivery-view.dto';
import type { ProductDelivery } from './entities/product-delivery.entity';

// Pathao's own status vocabulary isn't confirmed from the sandbox docs we
// have — matched case-insensitively, and anything unrecognized is logged
// rather than silently ignored, so ops can tell us the real terminal string.
//
// UNVERIFIED against Pathao, like CANCELLED_STATUS_MARKER below — see
// OPEN-ITEMS A43. Both are guesses until a live order reaches each state.
export const DELIVERED_STATUS_MARKERS = ['delivered'];

// Pathao's slugs for a cancelled order (e.g. "Pickup_Cancelled") are assumed
// to all contain "cancel". Deliberately a substring match and nothing broader:
// "Return" and "Delivery_Failed" mean the parcel is physically coming back,
// which is a different situation from the order being void.
//
// UNVERIFIED against Pathao, like DELIVERED_STATUS_MARKERS above — see
// OPEN-ITEMS A43 / A57.
export const CANCELLED_STATUS_MARKER = 'cancel';

/** What a Pathao status string means for the parcel. */
export function classifyPathaoStatus(orderStatus: string): {
  isDelivered: boolean;
  isCancelled: boolean;
} {
  const status = orderStatus.toLowerCase();
  return {
    isDelivered: DELIVERED_STATUS_MARKERS.includes(status),
    isCancelled: status.includes(CANCELLED_STATUS_MARKER),
  };
}

/**
 * Where a parcel is, derived from its milestone timestamps (see DeliveryStage).
 *
 * The one definition of a delivery's stage. Pure, so a module that cannot
 * inject ProductDeliveriesService — RewardsService's pending-settlements list,
 * which used to re-derive this and missed `cancelledAt` (A56) — imports it
 * instead. `ProductDeliveriesService.whereStage` is its SQL twin; keep the two
 * in step.
 */
export function deliveryStageOf(
  d: Pick<
    ProductDelivery,
    'deliveredAt' | 'cancelledAt' | 'consignmentId' | 'receivedAtWarehouseAt'
  >,
): DeliveryStage {
  if (d.deliveredAt) return DeliveryStage.DELIVERED;
  if (d.cancelledAt) return DeliveryStage.CANCELLED;
  if (d.consignmentId) return DeliveryStage.IN_TRANSIT;
  if (d.receivedAtWarehouseAt) return DeliveryStage.AT_WAREHOUSE;
  return DeliveryStage.AWAITING_WAREHOUSE;
}
