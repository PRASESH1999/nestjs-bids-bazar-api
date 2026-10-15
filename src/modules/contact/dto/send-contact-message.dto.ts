import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CONTACT_TOPICS = [
  'general',
  'order',
  'payment',
  'selling',
  'account',
  'report',
  'advertising',
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** How each topic reads in the support inbox — the same words the form shows. */
export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  general: 'General question',
  order: 'Order & delivery',
  payment: 'Payment',
  selling: 'Selling',
  account: 'Account',
  report: 'Report an issue',
  advertising: 'Advertising',
};

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** A message from the public Contact Us form. */
export class SendContactMessageDto {
  @ApiProperty({ enum: CONTACT_TOPICS, example: 'general' })
  @IsIn(CONTACT_TOPICS)
  topic: ContactTopic;

  @ApiProperty({ example: 'Sita Shrestha', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'sita@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({
    description: 'Nepali mobile number, without the +977 prefix',
    example: '9841234567',
  })
  @Transform(trim)
  @IsOptional()
  @Matches(/^9[78]\d{8}$/, {
    message: 'phone must be a 10-digit Nepali mobile number',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Order, transaction or product code the message is about',
    example: 'BB-SKU-12',
    maxLength: 64,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message: string;
}
