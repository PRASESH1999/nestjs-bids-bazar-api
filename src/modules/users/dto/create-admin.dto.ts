import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

export class CreateAdminDto {
  @ApiProperty({
    example: 'Sita Sharma',
    description: 'The staff member’s full name',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({
    example: 'admin@test.com',
    description: 'The email of the admin',
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

  @ApiProperty({
    enum: [Role.ADMIN, Role.SUPERADMIN],
    example: Role.ADMIN,
    description: 'The role to assign',
  })
  // Staff roles only — `@IsEnum(Role)` also let USER through this endpoint.
  @IsNotEmpty()
  @IsIn([Role.ADMIN, Role.SUPERADMIN])
  role: Role.ADMIN | Role.SUPERADMIN;
}
