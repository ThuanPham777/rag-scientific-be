// src/paper/dto/related-papers.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// Request
export class GetRelatedPapersRequestDto {
  @ApiPropertyOptional({
    description: 'Number of top related papers to return',
    default: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  topK?: number;

  @ApiPropertyOptional({
    description: 'Max arXiv search results before re-ranking',
    default: 30,
    minimum: 10,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(50)
  maxResults?: number;
}

// Response items
export class RelatedPaperItemDto {
  @ApiProperty({ description: 'arXiv paper ID', example: '2312.10997' })
  arxivId: string;

  @ApiProperty({ description: 'Paper title' })
  title: string;

  @ApiProperty({ description: 'Paper abstract' })
  abstract: string;

  @ApiProperty({ description: 'List of authors', type: [String] })
  authors: string[];

  @ApiProperty({ description: 'arXiv categories', type: [String] })
  categories: string[];

  @ApiProperty({ description: 'arXiv URL' })
  url: string;

  @ApiProperty({ description: 'Relevance score (0-1)' })
  score: number;

  @ApiProperty({ description: 'Reason for recommendation' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Order index in the list',
  })
  orderIndex?: number;
}

export class RelatedPapersResultDto {
  @ApiProperty({ description: 'Paper ID' })
  paperId: string;

  @ApiProperty({ type: [RelatedPaperItemDto] })
  results: RelatedPaperItemDto[];

  @ApiProperty({ description: 'Whether results were loaded from cache' })
  fromCache: boolean;
}

export class RelatedPapersResponseDto extends ApiResponseDto<RelatedPapersResultDto> {
  @ApiProperty({ type: RelatedPapersResultDto })
  declare data: RelatedPapersResultDto;
}
