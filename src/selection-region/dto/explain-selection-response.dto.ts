// src/selection/dto/explain-selection-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class SelectionCitationDto {
  @ApiProperty({ required: false })
  pageNumber?: number;

  @ApiProperty({ required: false })
  snippet?: string;

  @ApiProperty({ required: false })
  chunkId?: string;

  @ApiProperty({ required: false })
  elementId?: string;

  @ApiProperty({ required: false })
  score?: number;
}

export class ExplainSelectionResultDto {
  @ApiProperty()
  selectionRegionId: string;

  @ApiProperty()
  qaTurnId: string;

  @ApiProperty()
  answer: string;

  @ApiProperty({ type: [SelectionCitationDto] })
  citations: SelectionCitationDto[];

  @ApiProperty({
    required: false,
    description:
      'Nếu Python nhận diện đây là công thức và tạo Formula Insight thì có ID ở đây',
  })
  formulaInsightId?: string;
}

export class ExplainSelectionResponseDto extends BaseResponseDto<ExplainSelectionResultDto> {
  @ApiProperty({ type: ExplainSelectionResultDto })
  declare data: ExplainSelectionResultDto;
}
