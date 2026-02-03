// src/upload/dto/upload-single.response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UploadResultDto } from './upload-result.dto';

/**
 * Single file upload response
 */
export class UploadSingleResponseDto extends ApiResponseDto<UploadResultDto> {
  @ApiProperty({ type: UploadResultDto })
  declare data: UploadResultDto;
}
