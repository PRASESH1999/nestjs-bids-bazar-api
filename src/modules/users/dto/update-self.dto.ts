import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH /users/me — supply or correct the account's name and phone.
 *
 * The "complete your profile" step after a social-login signup, and the way to
 * fix a name a KYC reviewer rejected. Both fields optional; send only what
 * changes.
 */
export class UpdateSelfDto {
  @ApiPropertyOptional({
    example: 'Ram Bahadur Thapa',
    description:
      'Full name as on your identity document. Cannot be changed while KYC is under review or after it is approved.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({
    example: '+9779812345678',
    description:
      'Mobile number. Saved as pending (unverified) — your verified number, if any, stays in place until the new one is confirmed via POST /users/me/phone/send-otp → verify-otp.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phone must be 7–15 digits, optionally starting with +',
  })
  phone?: string;
}
