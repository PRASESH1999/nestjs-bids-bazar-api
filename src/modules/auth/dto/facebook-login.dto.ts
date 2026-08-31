import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FacebookLoginDto {
  @ApiProperty({
    description:
      'User access token returned by the Facebook Login SDK on the client',
  })
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
