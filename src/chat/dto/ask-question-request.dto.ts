import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Ask question request DTO
 *
 * @description Request để hỏi câu hỏi về paper trong một conversation.
 * Backend sẽ gọi RAG service để retrieve context và generate answer.
 */
export class AskQuestionRequestDto {
  @ApiProperty({
    description:
      'Conversation ID - phải là conversation của user hiện tại. Nếu chưa có, tạo mới qua `/conversations`',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    description:
      'Câu hỏi của user về paper. RAG sẽ retrieve relevant chunks và generate answer với citations.',
    example: 'What is the main contribution of this paper?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description:
      'URL hình ảnh (figure/table) nếu user muốn hỏi về một hình cụ thể trong paper. Dùng cho visual Q&A.',
    example:
      'https://rag-scientific.s3.amazonaws.com/papers/uuid/images/figure_3.png',
    format: 'uri',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
