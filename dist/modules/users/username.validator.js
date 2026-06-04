"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsValidUsernameConstraint = exports.RESERVED_USERNAMES = void 0;
exports.validateUsernameFormat = validateUsernameFormat;
exports.IsValidUsername = IsValidUsername;
const class_validator_1 = require("class-validator");
exports.RESERVED_USERNAMES = [
    'admin',
    'superadmin',
    'support',
    'bidsbazar',
    'null',
    'system',
    'root',
    'api',
];
function validateUsernameFormat(raw) {
    if (typeof raw !== 'string')
        return 'INVALID_FORMAT';
    const value = raw.trim().toLowerCase();
    if (value.length < 3 || value.length > 30)
        return 'INVALID_FORMAT';
    if (!/^[a-z0-9._-]+$/.test(value))
        return 'INVALID_FORMAT';
    if (/^[.-]/.test(value) || /[.-]$/.test(value))
        return 'INVALID_FORMAT';
    if (/\.\.|--|__/.test(value))
        return 'INVALID_FORMAT';
    if (exports.RESERVED_USERNAMES.includes(value)) {
        return 'RESERVED';
    }
    return null;
}
let IsValidUsernameConstraint = class IsValidUsernameConstraint {
    validate(value) {
        return validateUsernameFormat(value) === null;
    }
    defaultMessage(args) {
        if (validateUsernameFormat(args.value) === 'RESERVED') {
            return 'This username is reserved and cannot be used.';
        }
        return ('Username must be 3–30 characters using only lowercase letters, digits, ' +
            'period, underscore or hyphen, may not start or end with a period or ' +
            'hyphen, and may not contain consecutive special characters.');
    }
};
exports.IsValidUsernameConstraint = IsValidUsernameConstraint;
exports.IsValidUsernameConstraint = IsValidUsernameConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isValidUsername', async: false })
], IsValidUsernameConstraint);
function IsValidUsername(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isValidUsername',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: IsValidUsernameConstraint,
        });
    };
}
//# sourceMappingURL=username.validator.js.map