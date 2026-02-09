// src/paper/dto/paper-summary.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

export class PaperSummaryDto {
  @ApiProperty({ description: 'Paper ID' })
  paperId: string;

  @ApiProperty({ description: 'LLM-generated comprehensive summary' })
  summary: string;
}

export class PaperSummaryResponseDto extends ApiResponseDto<PaperSummaryDto> {
  @ApiProperty({ type: PaperSummaryDto })
  declare data: PaperSummaryDto;
}
