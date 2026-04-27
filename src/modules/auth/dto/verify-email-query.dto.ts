import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query DTO for GET /auth/verify-email.
 * Expects a raw token string in the query params.
 */
export class VerifyEmailQueryDto {
  @ApiProperty({
    description: 'The raw verification token sent to the user via email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
