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
}
