import { ForbiddenException } from '@nestjs/common';
import { Role } from '@common/enums/role.enum';
import type { User } from './entities/user.entity';

export type ProfileField = 'fullName' | 'phone';

/**
 * Which identity fields the account still has to supply.
 *
 * Password registration collects both, so this is normally empty — it exists
 * for social-login accounts: Google/Facebook never share a phone, and may not
 * share a name. The client shows a "complete your profile" step whenever it is
 * non-empty, right after signup, and fills it via PATCH /users/me.
 *
 * A phone counts as supplied once it is pending — verifying it is a separate,
 * later step (and the KYC gate). Staff accounts are exempt: they never go
 * through KYC or sell, so nothing downstream needs either field.
 */
export function computeMissingProfileFields(
  user: Pick<User, 'role' | 'fullName' | 'phone' | 'pendingPhone'>,
): ProfileField[] {
  if (user.role !== Role.USER) return [];

  const missing: ProfileField[] = [];
  if (!user.fullName) missing.push('fullName');
  if (!user.phone && !user.pendingPhone) missing.push('phone');
  return missing;
}

/** The `errorCode` a client gets when it tries to buy without a phone on file. */
export const PHONE_REQUIRED_ERROR_CODE = 'PHONE_REQUIRED';

/**
 * Refuse a bid or an Instant Buy from an account with no mobile number.
 *
 * Social signups arrive without one, and the "complete your profile" step that
 * asks for it can be closed — so the number is enforced where it matters: a
 * winning buyer has to be reachable for payment and delivery.
 *
 * "On file" means the same thing as in `computeMissingProfileFields`: a pending
 * number counts. Verifying it is still the separate gate for selling (KYC).
 *
 * Throws 403 with `errorCode: 'PHONE_REQUIRED'` so a client can tell this apart
 * from the other 403s on these routes and send the user to add a number.
 */
export function assertPhoneOnFileForBuying(
  user: Pick<User, 'phone' | 'pendingPhone'> | null,
): void {
  if (user?.phone || user?.pendingPhone) return;
  throw new ForbiddenException({
    statusCode: 403,
    errorCode: PHONE_REQUIRED_ERROR_CODE,
    message: 'Add your mobile number to your account before bidding or buying.',
  });
}
