import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/*
 * Registration collects no name.
 *
 * The account's public identity is the generated `username`; the person's legal
 * name is established later, by KYC, where it is checked against a document.
 * Asking for one here would collect an unverified name that nothing validates
 * and that would then compete with the verified one.
 */
export class RegisterDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password (min 6 chars)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
