// src/paper/dto/list-papers-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaperItemDto } from './create-paper-response.dto';
import {
  ApiResponseDto,
  CursorPaginationDto,
} from '../../common/dto/api-response.dto';

export class ListPapersResponseDto extends ApiResponseDto<
  CursorPaginationDto<PaperItemDto>
> {
  @ApiProperty({ type: CursorPaginationDto })
  declare data: CursorPaginationDto<PaperItemDto>;
}
