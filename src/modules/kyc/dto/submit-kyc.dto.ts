import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { DocumentType } from '@common/enums/document-type.enum';
import { AddressDto } from './address.dto';
import { BankDetailDto } from './bank-detail.dto';

function parseJsonField(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export class SubmitKycDto {
  @ApiProperty({ enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Permanent address as a JSON string in multipart forms',
    type: AddressDto,
  })
  @Transform(({ value }) => parseJsonField(value))
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress: AddressDto;

  @ApiPropertyOptional({
    description: 'Temporary address as a JSON string in multipart forms',
    type: AddressDto,
  })
  @IsOptional()
  @Transform(({ value }) => parseJsonField(value))
  @ValidateNested()
  @Type(() => AddressDto)
  temporaryAddress?: AddressDto;

  @ApiProperty({
    description: 'Bank details as a JSON string in multipart forms',
    type: BankDetailDto,
  })
  @Transform(({ value }) => parseJsonField(value))
  @ValidateNested()
  @Type(() => BankDetailDto)
  bankDetails: BankDetailDto;
}
