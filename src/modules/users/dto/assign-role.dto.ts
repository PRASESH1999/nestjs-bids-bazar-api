import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

export class AssignRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.ADMIN,
    description: 'The role to assign',
  })
  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;
}
