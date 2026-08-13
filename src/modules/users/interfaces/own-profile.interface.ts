import { Role } from '@common/enums/role.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { SellerTier } from '@common/enums/seller-tier.enum';

export interface KycSummary {
  status: KycStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
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
  name: string;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  nameChangedAt: Date | null;
  usernameChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  kyc: KycSummary | null;
  pendingEmailChange: PendingEmailChangeSummary | null;
  rewards: RewardsSummary;
}
