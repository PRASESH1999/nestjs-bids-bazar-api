import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateShippingAddressDto {
  @ApiProperty({ example: 'Home', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: 'Lily Shrestha', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  recipientName: string;

  @ApiProperty({ example: '+9779812345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'recipientPhone must be 7–15 digits, optionally starting with +',
  })
  recipientPhone: string;

  @ApiProperty({ example: 'Bagmati' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Balaju' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  street: string;

  @ApiPropertyOptional({ example: '16' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  wardNumber?: string;

  @ApiPropertyOptional({ example: 'Blue gate opposite the school' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  landmark?: string;

  @ApiPropertyOptional({
    description:
      'Preselect this address at checkout. Setting it clears the flag on the others; the first address saved becomes the default regardless.',
    default: false,
  })
  // Accepts the string form too — the frontend may post this as form data.
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as unknown;
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateShippingAddressDto extends PartialType(
  CreateShippingAddressDto,
) {}
