import { Role } from '@common/enums/role.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { SellerTier } from '@common/enums/seller-tier.enum';
import type { ProfileField } from '../profile-completion';

export interface KycSummary {
  status: KycStatus;
  /** The name snapshotted onto the submission — what the reviewer checked. */
  fullName: string;
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
  /** The account's full name, collected at registration. */
  fullName: string | null;
  /** True once KYC is APPROVED — the name has been checked against a document. */
  isNameVerified: boolean;
  /** False while KYC is under review or approved; PATCH /users/me refuses then. */
  canEditName: boolean;
  /** Identity fields still to supply (social-login signups); empty when complete. */
  missingProfileFields: ProfileField[];
  /** The verified number. Null until the first OTP is confirmed. */
  phone: string | null;
  isPhoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  /** A number awaiting verification — e.g. the one given at registration. */
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
