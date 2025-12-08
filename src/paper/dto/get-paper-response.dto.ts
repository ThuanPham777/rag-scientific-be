import { ApiProperty } from '@nestjs/swagger';
import { PaperItemDto } from './create-paper-response.dto';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class GetPaperResponseDto extends BaseResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto })
  declare data: PaperItemDto;
}
