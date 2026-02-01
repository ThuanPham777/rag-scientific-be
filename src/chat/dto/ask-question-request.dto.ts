import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AskQuestionRequestDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ description: 'User question' })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description: 'Optional image URL for visual questions',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
