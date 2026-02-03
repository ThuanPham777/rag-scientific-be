// src/paper/dto/list-papers-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaperItemDto } from './create-paper-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * List papers response DTO
 */
export class ListPapersResponseDto extends ApiResponseDto<PaperItemDto[]> {
  @ApiProperty({ type: [PaperItemDto], description: 'List of papers' })
  declare data: PaperItemDto[];
}
