import { IsArray, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderImagesDto {
  @ApiProperty({
    description: 'All image IDs for this product in the desired display order. Must include every existing image — the first entry becomes the preview.',
    type: [String],
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  imageIds: string[];
}
