import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class PaperItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  url?: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty()
  createdAt: Date;
}

export class CreatePaperResponseDto extends BaseResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto })
  declare data: PaperItemDto;
}
