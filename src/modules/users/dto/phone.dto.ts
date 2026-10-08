import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiPropertyOptional({
    example: '+9779812345678',
    description:
      'The number to verify. Omit it to send the code to your pending number (the one given at registration). Sending a different number replaces the pending one; an already-verified number is rejected.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phone must be 7–15 digits, optionally starting with +',
  })
  phone?: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '123456', description: 'The six-digit code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}
