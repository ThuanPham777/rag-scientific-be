import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class AskMultiPaperRequestDto {
  @ApiProperty({
    description: 'List of paper IDs to query across',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  paperIds: string[];

  @ApiProperty({ description: 'User question' })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description: 'Optional conversation ID for history tracking',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class MultiPaperSourceDto {
  @ApiProperty()
  paperId: string;

  @ApiProperty()
  title: string;
}

export class AskMultiPaperResultDto {
  @ApiProperty()
  answer: string;

  @ApiProperty({ type: [Object] })
  citations: any[];

  @ApiProperty({ type: [MultiPaperSourceDto] })
  sources: MultiPaperSourceDto[];

  @ApiPropertyOptional()
  assistantMessageId?: string;

  @ApiPropertyOptional()
  userMessageId?: string;

  @ApiPropertyOptional()
  modelName?: string;

  @ApiPropertyOptional()
  tokenCount?: number;
}

export class AskMultiPaperResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: AskMultiPaperResultDto })
  data: AskMultiPaperResultDto;
}
