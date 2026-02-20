import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

export class NotebookItemDto {
  @ApiProperty({ description: 'Notebook ID (UUID)', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'User ID', format: 'uuid' })
  userId!: string;

  @ApiProperty({ description: 'Notebook title', example: 'My Research Notes' })
  title!: string;

  @ApiPropertyOptional({ description: 'Content preview (first 200 chars)' })
  contentPreview?: string;

  @ApiProperty({ description: 'Order index', example: 0 })
  orderIndex!: number;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp', format: 'date-time' })
  updatedAt!: Date;
}

export class NotebookDetailDto extends NotebookItemDto {
  @ApiProperty({ description: 'Full HTML content' })
  content!: string;
}

export class ListNotebooksResponseDto extends ApiResponseDto<NotebookItemDto[]> {
  @ApiProperty({ type: [NotebookItemDto] })
  declare data: NotebookItemDto[];
}

export class NotebookResponseDto extends ApiResponseDto<NotebookDetailDto> {
  @ApiProperty({ type: NotebookDetailDto })
  declare data: NotebookDetailDto;
}

export class DeleteNotebookResultDto {
  @ApiProperty({ description: 'Result message', example: 'Notebook deleted successfully' })
  message!: string;
}

export class DeleteNotebookResponseDto extends ApiResponseDto<DeleteNotebookResultDto> {
  @ApiProperty({ type: DeleteNotebookResultDto })
  declare data: DeleteNotebookResultDto;
}
