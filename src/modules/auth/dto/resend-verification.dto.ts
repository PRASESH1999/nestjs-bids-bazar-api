import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Body DTO for POST /auth/resend-verification.
 */
export class ResendVerificationDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to resend the verification link to',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
