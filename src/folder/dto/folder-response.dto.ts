// src/folder/dto/folder-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../../common/dto/api-response.dto';
import { PaperItemDto } from '../../paper/dto/create-paper-response.dto';

/**
 * Paper count DTO
 */
export class PaperCountDto {
  @ApiProperty({ description: 'Number of papers in folder', example: 5 })
  papers: number;
}

/**
 * Folder item DTO
 */
export class FolderItemDto {
  @ApiProperty({ description: 'Folder ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'uuid-here' })
  userId: string;

  @ApiProperty({
    description: 'Folder name',
    example: 'Machine Learning Papers',
  })
  name: string;

  @ApiProperty({ description: 'Sort order', example: 0 })
  orderIndex: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: PaperCountDto, description: 'Paper count' })
  _count?: PaperCountDto;
}

/**
 * Folder with papers DTO
 */
export class FolderWithPapersDto extends FolderItemDto {
  @ApiProperty({ type: [PaperItemDto], description: 'Papers in folder' })
  papers: PaperItemDto[];
}

/**
 * List folders response DTO
 */
export class ListFoldersResponseDto extends ApiResponseDto<FolderItemDto[]> {
  @ApiProperty({ type: [FolderItemDto] })
  declare data: FolderItemDto[];
}

/**
 * Get folder response DTO
 */
export class GetFolderResponseDto extends ApiResponseDto<FolderWithPapersDto> {
  @ApiProperty({ type: FolderWithPapersDto })
  declare data: FolderWithPapersDto;
}

/**
 * Create/Update folder response DTO
 */
export class FolderResponseDto extends ApiResponseDto<FolderItemDto> {
  @ApiProperty({ type: FolderItemDto })
  declare data: FolderItemDto;
}

/**
 * Delete folder result DTO
 */
export class DeleteFolderResultDto {
  @ApiProperty({
    description: 'Result message',
    example: 'Folder deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Number of papers deleted with the folder',
    example: 5,
  })
  deletedPapers: number;
}

/**
 * Delete folder response DTO
 */
export class DeleteFolderResponseDto extends ApiResponseDto<DeleteFolderResultDto> {
  @ApiProperty({ type: DeleteFolderResultDto })
  declare data: DeleteFolderResultDto;
}

/**
 * Move paper result DTO
 */
export class MovePaperResultDto {
  @ApiProperty({ description: 'Paper ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'File name', example: 'paper.pdf' })
  fileName: string;

  @ApiPropertyOptional({ description: 'RAG file ID', example: 'uuid-here' })
  ragFileId?: string;

  @ApiPropertyOptional({ description: 'Paper title', example: 'Deep Learning' })
  title?: string;

  @ApiPropertyOptional({ description: 'New folder ID', example: 'uuid-here' })
  folderId?: string | null;
}

/**
 * Move paper response DTO
 */
export class MovePaperResponseDto extends ApiResponseDto<MovePaperResultDto> {
  @ApiProperty({ type: MovePaperResultDto })
  declare data: MovePaperResultDto;
}

/**
 * List uncategorized papers response DTO
 */
export class ListUncategorizedPapersResponseDto extends ApiResponseDto<
  PaperItemDto[]
> {
  @ApiProperty({ type: [PaperItemDto] })
  declare data: PaperItemDto[];
}
