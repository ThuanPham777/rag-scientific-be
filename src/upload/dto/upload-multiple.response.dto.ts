// src/upload/dto/upload-multiple.response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UploadMultipleResultDto } from './upload-multiple-result.dto';

/**
 * Multiple file upload response
 */
export class UploadMultiplePdfResponseDto extends ApiResponseDto<UploadMultipleResultDto> {
  @ApiProperty({ type: UploadMultipleResultDto })
  declare data: UploadMultipleResultDto;
}
