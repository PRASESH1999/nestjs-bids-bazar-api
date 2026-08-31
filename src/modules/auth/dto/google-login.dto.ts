import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID token returned by Google Identity Services on the client',
  })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
