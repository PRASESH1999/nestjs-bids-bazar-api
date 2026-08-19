import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

export class CreateAdminDto {
  @ApiProperty({ example: 'Admin User', description: 'The name of the admin' })
  @IsNotEmpty()
  @IsString()
  name: string;

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
  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;
}
