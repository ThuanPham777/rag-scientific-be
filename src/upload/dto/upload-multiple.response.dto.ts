import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { UploadMultipleResultDto } from './upload-multiple-result.dto';

export class UploadMultiplePdfResponseDto extends BaseResponseDto<UploadMultipleResultDto> {
  @ApiProperty({ type: UploadMultipleResultDto })
  declare data?: UploadMultipleResultDto;
}
