// src/paper/dto/get-paper-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaperItemDto } from './create-paper-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Get paper by ID response DTO
 */
export class GetPaperResponseDto extends ApiResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto })
  declare data: PaperItemDto;
}
