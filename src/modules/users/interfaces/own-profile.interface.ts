import { Role } from '@common/enums/role.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { SellerTier } from '@common/enums/seller-tier.enum';

export interface KycSummary {
  status: KycStatus;
  /** The legal name on the submission. Only authoritative once APPROVED. */
  fullName: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  /** Which parts the reviewer flagged, for the correction form to highlight. */
  rejectedFields: string[];
}

export interface PendingEmailChangeSummary {
  newEmail: string;
  expiresAt: Date;
}

export interface RewardsSummary {
  buyerPoints: number;
  sellerPoints: number;
  sellerTier: SellerTier;
}

export interface OwnProfileResponse {
  id: string;
  /** The public identity. System-generated, stable, and the only name most
   *  surfaces have — see the note on the User entity. */
  username: string;
  email: string;
  /** Legal name from an APPROVED KYC, else null. Never editable here. */
  fullName: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  /** A number with an outstanding verification code, if any. */
  pendingPhone: string | null;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  kyc: KycSummary | null;
  pendingEmailChange: PendingEmailChangeSummary | null;
  rewards: RewardsSummary;
}
