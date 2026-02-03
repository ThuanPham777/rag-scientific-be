import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Create conversation request DTO
 *
 * @description Tạo conversation mới để chat về paper.
 * Mỗi conversation là một phiên hội thoại độc lập, có thể có nhiều conversations cho cùng 1 paper.
 */
export class CreateConversationRequestDto {
  @ApiProperty({
    description:
      'Paper ID (UUID) - ID của paper muốn chat. Phải là paper của user hiện tại với status = COMPLETED.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsString()
  paperId: string;

  @ApiPropertyOptional({
    description:
      'Tiêu đề conversation - nếu không cung cấp, sẽ tự động tạo từ câu hỏi đầu tiên.',
    example: 'Research on Transformer Architecture',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  title?: string;
}
