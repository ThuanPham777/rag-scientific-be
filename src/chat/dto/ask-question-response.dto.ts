// src/chat/dto/ask-question-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Citation DTO for chat responses
 *
 * @description Thông tin nguồn trích dẫn từ paper để hiển thị citations trong UI.
 * Bao gồm vị trí trong PDF (page, bbox) để highlight và navigate.
 */
export class ChatCitationDto {
  @ApiPropertyOptional({
    description:
      'Số trang trong PDF (1-indexed) - dùng để navigate PDF viewer đến trang này',
    example: 5,
    minimum: 1,
  })
  pageNumber?: number;

  @ApiPropertyOptional({
    description:
      'Đoạn text được trích từ nguồn - hiển thị preview trong citation card',
    example: 'The model achieves 95% accuracy on the benchmark dataset...',
    maxLength: 500,
  })
  snippet?: string;

  @ApiPropertyOptional({
    description: 'Element ID từ RAG - internal reference',
    example: 'elem-abc123',
  })
  elementId?: string;

  @ApiPropertyOptional({
    description: 'Chunk ID từ vector store - dùng cho debugging',
    example: 'chunk-456xyz',
  })
  chunkId?: string;

  @ApiPropertyOptional({
    description:
      'Relevance score từ semantic search (0-1) - cao hơn = liên quan hơn',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  score?: number;

  @ApiPropertyOptional({
    description:
      'Source ID hiển thị trong answer (e.g., [S1], [S2]) - match với inline citations',
    example: 'S1',
  })
  sourceId?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề section chứa citation (từ GROBID) - context cho user',
    example: 'Methodology',
  })
  sectionTitle?: string;

  @ApiPropertyOptional({
    description:
      'Bounding box [x, y, width, height] để highlight vùng trong PDF viewer',
    example: [72, 200, 468, 50],
  })
  bbox?: any;

  @ApiPropertyOptional({
    description:
      'Chiều rộng layout PDF (points) - dùng để tính toán bbox position',
    example: 612,
  })
  layoutWidth?: number;

  @ApiPropertyOptional({
    description:
      'Chiều cao layout PDF (points) - dùng để tính toán bbox position',
    example: 792,
  })
  layoutHeight?: number;

  @ApiPropertyOptional({
    description:
      'Paper ID nguồn (cho MULTI_PAPER chat) - xác định citation từ paper nào',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  sourcePaperId?: string;

  @ApiPropertyOptional({
    description:
      'Tiêu đề paper nguồn (cho MULTI_PAPER) - hiển thị trong citation card',
    example: 'Attention Is All You Need',
  })
  sourcePaperTitle?: string;

  @ApiPropertyOptional({
    description:
      'URL file PDF nguồn (cho MULTI_PAPER) - switch PDF viewer sang paper này',
    example:
      'https://rag-scientific.s3.amazonaws.com/papers/uuid/attention.pdf',
    format: 'uri',
  })
  sourceFileUrl?: string;
}

/**
 * Ask question result DTO
 *
 * @description Kết quả trả lời câu hỏi từ RAG pipeline.
 * Bao gồm answer text, citations để verify, và message IDs để track.
 */
export class AskQuestionResultDto {
  @ApiProperty({
    description:
      'Câu trả lời do AI generate dựa trên retrieved context. Có thể chứa inline citations như [S1], [S2].',
    example:
      'Based on the paper [S1], the Transformer model achieves state-of-the-art results by using self-attention mechanisms instead of recurrence [S2].',
  })
  answer: string;

  @ApiProperty({
    type: [ChatCitationDto],
    description:
      'Danh sách citations/sources - match với [S1], [S2] trong answer. Dùng để hiển thị và navigate.',
  })
  citations: ChatCitationDto[];

  @ApiPropertyOptional({
    description:
      'ID của message AI (role=ASSISTANT) vừa lưu - dùng cho message history. May be absent for freeform generation.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  assistantMessageId?: string;

  @ApiPropertyOptional({
    description: 'ID của message user vừa lưu - pair với assistantMessageId. Optional for freeform generation.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  userMessageId?: string;

  @ApiPropertyOptional({
    description:
      'Conversation ID - chỉ trả về khi tạo conversation mới (quick ask flow)',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
  })
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Tên model AI đã dùng - logging và analytics',
    example: 'gpt-4-turbo-preview',
  })
  modelName?: string;

  @ApiPropertyOptional({
    description: 'Số tokens tiêu thụ cho response - tracking usage/cost',
    example: 1847,
    minimum: 0,
  })
  tokenCount?: number;
}

/**
 * Ask question response DTO
 *
 * @description Response cho API `/chat/ask`. Bao gồm answer và citations
 * để frontend render chat bubble với clickable sources.
 */
export class AskQuestionResponseDto extends ApiResponseDto<AskQuestionResultDto> {
  @ApiProperty({ type: AskQuestionResultDto, description: 'Kết quả Q&A' })
  declare data: AskQuestionResultDto;
}
