import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '123456', description: '6-digit code sent via SMS' })
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}
