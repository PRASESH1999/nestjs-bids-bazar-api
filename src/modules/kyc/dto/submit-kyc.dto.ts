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

  // --- Contact ---

  @ApiProperty({ example: '+9779812345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'primaryPhone must be 7–15 digits, optionally starting with +',
  })
  primaryPhone: string;

  @ApiPropertyOptional({
    example: '+9779812345679',
    description: 'Emergency contact number',
  })
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'secondaryPhone must be 7–15 digits, optionally starting with +',
  })
  secondaryPhone?: string;

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

  // --- Bank Details (optional at submission; all-or-nothing — see
  // KycService.submitKyc. Required later, via PATCH /kyc/me/bank, before the
  // user is allowed to list a product for sale.) ---

  @ApiPropertyOptional({ example: 'Nepal Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @ApiPropertyOptional({
    example: '1234567890',
    description: '9–20 digit account number',
  })
  @IsOptional()
  @Matches(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' })
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Kathmandu Branch' })
  @IsOptional()
  @IsString()
  branch?: string;

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

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Required when documentType is NID_CARD',
  })
  @IsOptional()
  nidFront?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Required when documentType is NID_CARD',
  })
  @IsOptional()
  nidBack?: any;
}
