// src/paper/dto/brainstorm-questions.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// Request
export class BrainstormQuestionsRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional text input from user to guide question generation. Questions will be tailored to this topic/interest.',
    example: 'How does the attention mechanism work?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  textInput?: string;
}

// Response
export class BrainstormQuestionsResultDto {
  @ApiProperty({ description: 'Paper ID' })
  paperId: string;

  @ApiProperty({
    description: 'Generated questions',
    type: [String],
    example: [
      'What is the main contribution of this paper?',
      'How does the proposed method compare to baselines?',
    ],
  })
  questions: string[];

  @ApiProperty({ description: 'Whether results were loaded from cache' })
  fromCache: boolean;
}

export class BrainstormQuestionsResponseDto extends ApiResponseDto<BrainstormQuestionsResultDto> {
  @ApiProperty({ type: BrainstormQuestionsResultDto })
  declare data: BrainstormQuestionsResultDto;
}
