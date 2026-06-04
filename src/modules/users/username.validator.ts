import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Usernames that may never be claimed by ordinary users. Matched
 * case-insensitively. Seeds bypass this list intentionally — seeded admins
 * write directly via the repository / DataSource and can use reserved handles
 * such as `superadmin`.
 */
export const RESERVED_USERNAMES = [
  'admin',
  'superadmin',
  'support',
  'bidsbazar',
  'null',
  'system',
  'root',
  'api',
] as const;

/**
 * Why a username failed validation. `TAKEN` is not produced here — it is a
 * uniqueness concern resolved in the service layer against the database.
 */
export type UsernameValidationError = 'INVALID_FORMAT' | 'RESERVED';

/**
 * Validate a username against the centralized format + reserved-list rules.
 *
 * Validation runs on the LOWERCASED form of the input — uniqueness is
 * case-insensitive and the canonical form is lowercase, even though the value
 * is stored as-typed for display. Returns `null` when valid, otherwise a
 * machine-readable reason code.
 *
 * Rules:
 *  - Length 3–30
 *  - Allowed chars: a-z, 0-9, underscore (_), period (.), hyphen (-)
 *  - Cannot start or end with `.` or `-`
 *  - Cannot contain consecutive `..`, `--`, or `__`
 *  - Cannot be a reserved username
 */
export function validateUsernameFormat(
  raw: unknown,
): UsernameValidationError | null {
  if (typeof raw !== 'string') return 'INVALID_FORMAT';

  const value = raw.trim().toLowerCase();

  // Length 3–30
  if (value.length < 3 || value.length > 30) return 'INVALID_FORMAT';

  // Allowed chars only
  if (!/^[a-z0-9._-]+$/.test(value)) return 'INVALID_FORMAT';

  // Cannot start or end with a period or hyphen
  if (/^[.-]/.test(value) || /[.-]$/.test(value)) return 'INVALID_FORMAT';

  // No consecutive special characters
  if (/\.\.|--|__/.test(value)) return 'INVALID_FORMAT';

  // Reserved list (value is already lowercased → case-insensitive)
  if ((RESERVED_USERNAMES as readonly string[]).includes(value)) {
    return 'RESERVED';
  }

  return null;
}

@ValidatorConstraint({ name: 'isValidUsername', async: false })
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validateUsernameFormat(value) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    if (validateUsernameFormat(args.value) === 'RESERVED') {
      return 'This username is reserved and cannot be used.';
    }
    return (
      'Username must be 3–30 characters using only lowercase letters, digits, ' +
      'period, underscore or hyphen, may not start or end with a period or ' +
      'hyphen, and may not contain consecutive special characters.'
    );
  }
}

/**
 * Class-validator decorator wrapping {@link validateUsernameFormat}. Used by
 * RegisterDto and UpdateUsernameDto so registration and the change endpoint
 * share the exact same format + reserved-list rules.
 */
export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isValidUsername',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsValidUsernameConstraint,
    });
  };
}
