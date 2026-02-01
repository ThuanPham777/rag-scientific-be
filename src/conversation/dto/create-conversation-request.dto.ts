import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateConversationRequestDto {
  @ApiProperty({ description: 'Paper ID or RAG file_id' })
  @IsString()
  paperId: string;

  @ApiPropertyOptional({ description: 'Conversation title' })
  @IsOptional()
  @IsString()
  title?: string;
}
