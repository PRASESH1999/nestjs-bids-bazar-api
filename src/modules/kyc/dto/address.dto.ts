import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddressDto {
  @ApiProperty({ example: '123 Main St' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsNotEmpty()
  @IsString()
  district: string;

  @ApiProperty({ example: 'Bagmati' })
  @IsNotEmpty()
  @IsString()
  province: string;

  @ApiPropertyOptional({ example: 'Nepal', default: 'Nepal' })
  @IsOptional()
  @IsString()
  country?: string;
}
