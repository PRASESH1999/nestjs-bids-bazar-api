import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/*
 * Registration collects the person's full name and phone number up front.
 *
 * Neither is verified here. The name is self-declared until KYC is approved
 * (the reviewer checks it against the identity document); the phone is held as
 * `pendingPhone` until the user confirms it with an OTP via
 * POST /users/me/phone/send-otp → verify-otp.
 */
export class RegisterDto {
  @ApiProperty({
    example: 'Ram Bahadur Thapa',
    description:
      'Full name, as it appears on the identity document the user will submit for KYC.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+9779812345678',
    description:
      'Mobile number. Saved unverified — confirm it later with an OTP via POST /users/me/phone/send-otp.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phone must be 7–15 digits, optionally starting with +',
  })
  phone: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password (min 6 chars)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
