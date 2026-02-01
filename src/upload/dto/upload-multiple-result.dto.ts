import { ApiProperty } from '@nestjs/swagger';
import { UploadResultDto } from './upload-result.dto';

export class UploadMultipleResultDto {
  @ApiProperty({ example: 2 })
  count: number;

  @ApiProperty({ type: UploadResultDto, isArray: true })
  items: UploadResultDto[];
}
