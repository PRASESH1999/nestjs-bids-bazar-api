import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Raw reset token from the email link',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiProperty({
    example: 'NewP@ssword1',
    description: 'New password (min 6 characters)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;
}
