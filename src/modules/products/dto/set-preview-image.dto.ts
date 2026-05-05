import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPreviewImageDto {
  @ApiProperty({ description: 'ID of the image to use as the preview thumbnail' })
  @IsUUID()
  previewImageId: string;
}
