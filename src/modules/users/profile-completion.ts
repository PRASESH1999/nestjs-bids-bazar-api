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
