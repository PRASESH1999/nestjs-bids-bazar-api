import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsValidUsername } from '../username.validator';

export class UpdateUsernameDto {
  @ApiProperty({
    example: 'ram_sharma',
    description:
      'New unique username (one-time change). 3–30 chars; lowercase letters, digits, . _ -.',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidUsername()
  username: string;
}
