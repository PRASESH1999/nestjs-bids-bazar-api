import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';

export class BidListItemAdminDto {
  id: string;
  amount: number;
  placedAt: string;
  bidderId: string;
  // Same name as the public BidListItemDto field, so one client type reads both.
  bidderUsername: string;
  bidderEmail: string;
  paymentStatus: BidPaymentStatus;
  paymentDeadline: string | null;
  isOriginalWinner: boolean;
  fallbackRank: number;
  isCurrentlyPaymentResponsible: boolean;
  /**
   * An Instant Buy payment hold rather than a bid placed in the auction. The
   * public bid views leave these out until they pay (A53); admins see them.
   */
  isInstantBuy: boolean;
}
