// src/upload/dto/upload-result.dto.ts
import { ApiProperty } from '@nestjs/swagger';

/**
 * Single file upload result
 */
export class UploadResultDto {
  @ApiProperty({
    description: 'S3 object key',
    example: 'pdf/550e8400-e29b-41d4-a716-446655440000.pdf',
  })
  key: string;

  @ApiProperty({
    description: 'Public URL to access the file',
    example: 'https://bucket.cloudfront.net/pdf/xxx.pdf',
  })
  url: string;
}
