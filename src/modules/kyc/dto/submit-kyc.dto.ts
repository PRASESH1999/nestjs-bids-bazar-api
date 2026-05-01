import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DocumentType } from '@common/enums/document-type.enum';

export class SubmitKycDto {
  @ApiProperty({ enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  // --- Permanent Address ---

  @ApiProperty({ example: 'Kathmandu-10' })
  @IsString()
  @IsNotEmpty()
  permanentAddressStreet: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString()
  @IsNotEmpty()
  permanentAddressCity: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString()
  @IsNotEmpty()
  permanentAddressDistrict: string;

  @ApiProperty({ example: 'Bagmati' })
  @IsString()
  @IsNotEmpty()
  permanentAddressProvince: string;

  @ApiPropertyOptional({ example: 'Nepal', default: 'Nepal' })
  @IsOptional()
  @IsString()
  permanentAddressCountry?: string;

  // --- Temporary Address (all optional) ---

  @ApiPropertyOptional({ example: 'Lalitpur-3' })
  @IsOptional()
  @IsString()
  temporaryAddressStreet?: string;

  @ApiPropertyOptional({ example: 'Lalitpur' })
  @IsOptional()
  @IsString()
  temporaryAddressCity?: string;

  @ApiPropertyOptional({ example: 'Lalitpur' })
  @IsOptional()
  @IsString()
  temporaryAddressDistrict?: string;

  @ApiPropertyOptional({ example: 'Bagmati' })
  @IsOptional()
  @IsString()
  temporaryAddressProvince?: string;

  @ApiPropertyOptional({ example: 'Nepal' })
  @IsOptional()
  @IsString()
  temporaryAddressCountry?: string;

  // --- Bank Details ---

  @ApiProperty({ example: 'Nepal Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @ApiProperty({
    example: '1234567890',
    description: '9–20 digit account number',
  })
  @Matches(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' })
  accountNumber: string;

  @ApiProperty({ example: 'Kathmandu Branch' })
  @IsString()
  @IsNotEmpty()
  branch: string;

  @ApiPropertyOptional({ example: 'NBLNNPKA' })
  @IsOptional()
  @IsString()
  swiftCode?: string;

  // --- Document Files ---

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Required when documentType is CITIZENSHIP',
  })
  @IsOptional()
  citizenshipFront?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Required when documentType is CITIZENSHIP',
  })
  @IsOptional()
  citizenshipBack?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Required when documentType is PASSPORT',
  })
  @IsOptional()
  passport?: any;
}
