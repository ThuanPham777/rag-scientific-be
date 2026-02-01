import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from '../../common/dto/base-response.dto';

export class PaperItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'RAG file_id for querying' })
  ragFileId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiPropertyOptional()
  fileSize?: number;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  abstract?: string;

  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  status: string;

  @ApiPropertyOptional()
  nodeCount?: number;

  @ApiPropertyOptional()
  tableCount?: number;

  @ApiPropertyOptional()
  imageCount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  processedAt?: Date;
}

export class CreatePaperResponseDto extends BaseResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto })
  declare data: PaperItemDto;
}
