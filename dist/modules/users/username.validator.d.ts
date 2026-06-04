import { ValidationArguments, ValidationOptions, ValidatorConstraintInterface } from 'class-validator';
export declare const RESERVED_USERNAMES: readonly ["admin", "superadmin", "support", "bidsbazar", "null", "system", "root", "api"];
export type UsernameValidationError = 'INVALID_FORMAT' | 'RESERVED';
export declare function validateUsernameFormat(raw: unknown): UsernameValidationError | null;
export declare class IsValidUsernameConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean;
    defaultMessage(args: ValidationArguments): string;
}
export declare function IsValidUsername(validationOptions?: ValidationOptions): (object: object, propertyName: string) => void;
