import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  currentPassword: string;

  @ApiProperty({
    example: 'NewP@ssword1',
    description: 'New password (min 6 characters, must differ from current)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;
}
