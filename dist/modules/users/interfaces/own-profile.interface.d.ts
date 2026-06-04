import { Role } from "../../../common/enums/role.enum";
import { KycStatus } from "../../../common/enums/kyc-status.enum";
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
}
