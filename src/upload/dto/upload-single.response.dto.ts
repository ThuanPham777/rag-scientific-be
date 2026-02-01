import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { UploadResultDto } from './upload-result.dto';

export class UploadSingleResponseDto extends BaseResponseDto<UploadResultDto> {
  @ApiProperty({ type: UploadResultDto })
  declare data?: UploadResultDto;
}
