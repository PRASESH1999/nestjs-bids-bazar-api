import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address associated with the account',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
