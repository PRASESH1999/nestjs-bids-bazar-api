import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({
    example: '+9779812345678',
    description:
      'The number to verify. Sending a code for a different number than the one on file replaces the pending request; a already-verified number is rejected.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phone must be 7–15 digits, optionally starting with +',
  })
  phone: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '123456', description: 'The six-digit code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}
