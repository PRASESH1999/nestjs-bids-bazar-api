import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSelfDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Display name (one-time change)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
