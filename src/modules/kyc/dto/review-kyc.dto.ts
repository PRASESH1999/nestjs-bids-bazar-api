import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  KYC_REJECTABLE_FIELDS,
  type KycRejectableField,
} from '../kyc-rejectable-fields';

export enum ReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewKycDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiPropertyOptional({
    description: 'Required when action is REJECT',
    example: 'Document image is blurry or unreadable',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;

  /**
   * Which parts of the submission are wrong.
   *
   * Optional, and separate from `rejectionReason` rather than parsed out of it:
   * the reason explains, this points. The applicant's form highlights exactly
   * these inputs, which matters now that omitted documents are retained — a
   * flagged document is the signal to re-upload that one, and only that one.
   */
  @ApiPropertyOptional({
    isArray: true,
    enum: KYC_REJECTABLE_FIELDS,
    description:
      'Field keys to flag on a rejection. Highlighted in the applicant’s correction form.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(KYC_REJECTABLE_FIELDS, { each: true })
  rejectedFields?: KycRejectableField[];
}
