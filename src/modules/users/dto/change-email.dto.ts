import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailDto {
  @ApiProperty({
    example: 'newemail@example.com',
    description: 'The new email address to switch to',
  })
  @IsEmail()
  @MaxLength(255)
  newEmail: string;

  @ApiProperty({
    description: 'Current account password for re-authentication',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  currentPassword: string;
}
