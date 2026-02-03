// src/upload/dto/upload-multiple-result.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UploadResultDto } from './upload-result.dto';

/**
 * Multiple file upload result
 */
export class UploadMultipleResultDto {
  @ApiProperty({ description: 'Number of files uploaded', example: 2 })
  count: number;

  @ApiProperty({
    type: [UploadResultDto],
    description: 'Upload results for each file',
  })
  items: UploadResultDto[];
}
