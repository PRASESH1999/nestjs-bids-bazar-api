import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    example: 'John Updated',
    description: 'The updated name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'john.new@example.com',
    description: 'The updated email',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
