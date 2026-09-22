import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentType } from '@common/enums/document-type.enum';

export class SubmitKycDto {
  // --- Identity ---

  @ApiProperty({
    example: 'Lily Shrestha',
    description:
      'Legal full name exactly as printed on the document. This becomes the authoritative name for the account once approved — User carries none.',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    example: '12-01-70-01234',
    description:
      'The number printed on the chosen document. Unique per document type — one document backs one account.',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-/ ]*$/, {
    message:
      'documentId may contain letters, digits, spaces, hyphens and slashes only',
  })
  documentId: string;

  // --- Contact ---
  //
  // The account's own phone is NOT here: it lives on User and must be verified
  // before this endpoint will accept a submission at all. What remains is an
  // alternative contact, which is never verified and never used to sign in.

  @ApiPropertyOptional({
    example: '+9779812345679',
    description: 'Alternative contact number (next of kin, landline)',
  })
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/, {
    message:
      'emergencyContactPhone must be 7–15 digits, optionally starting with +',
  })
  emergencyContactPhone?: string;

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

  // --- Remarks ---

  @ApiPropertyOptional({
    example: 'My legal name differs slightly from my NID due to marriage.',
    description: 'Optional note from the applicant for the reviewer',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  // --- Bank Details (mandatory at submission) ---

  @ApiProperty({ example: 'Nepal Bank' })
  @IsNotEmpty()
  @IsString()
  bankName: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  accountHolderName: string;

  @ApiProperty({
    example: '1234567890',
    description: '9–20 digit account number',
  })
  @IsNotEmpty()
  @Matches(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' })
  accountNumber: string;

  @ApiProperty({ example: 'Kathmandu Branch' })
  @IsNotEmpty()
  @IsString()
  branch: string;

  @ApiPropertyOptional({ example: 'NBLNNPKA' })
  @IsOptional()
  @IsString()
  swiftCode?: string;

  // --- Document Files ---

  // Every slot is optional at the DTO level and resolved in the service, which
  // is the only place that knows whether a file already exists to fall back on.
  // On a FIRST submission each slot the document type requires must be present.
  // On a RESUBMISSION an omitted slot keeps the file already on file, so
  // correcting an address does not mean re-photographing a passport. Switching
  // document type carries nothing over.

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'CITIZENSHIP: required on first submission; omit on resubmission to keep the existing file.',
  })
  @IsOptional()
  citizenshipFront?: unknown;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'CITIZENSHIP: required on first submission; omit on resubmission to keep the existing file.',
  })
  @IsOptional()
  citizenshipBack?: unknown;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'PASSPORT: required on first submission; omit on resubmission to keep the existing file.',
  })
  @IsOptional()
  passport?: unknown;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'NID_CARD: required on first submission; omit on resubmission to keep the existing file.',
  })
  @IsOptional()
  nidFront?: unknown;
}
