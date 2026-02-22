// src/folder/dto/folder-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../../common/dto/api-response.dto';
import { PaperItemDto } from '../../paper/dto/create-paper-response.dto';

/**
 * Paper count DTO
 *
 * @description Số lượng papers trong folder - dùng cho hiển thị badge count.
 */
export class PaperCountDto {
  @ApiProperty({
    description: 'Số papers hiện có trong folder',
    example: 12,
    minimum: 0,
  })
  papers: number;
}

/**
 * Folder item DTO
 *
 * @description Thông tin một folder trong library.
 * Folders giúp user tổ chức papers theo chủ đề/project.
 */
export class FolderItemDto {
  @ApiProperty({
    description: 'Folder ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'ID của user sở hữu folder',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description:
      'Tên folder - unique per user. Hiển thị trong sidebar library.',
    example: 'Deep Learning Research',
    maxLength: 100,
  })
  name: string;

  @ApiProperty({
    description:
      'Thứ tự sắp xếp (0-indexed) - dùng cho drag-drop reorder trong UI',
    example: 0,
    minimum: 0,
  })
  orderIndex: number;

  @ApiProperty({
    description: 'Thời điểm tạo folder',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời điểm update gần nhất (rename, reorder)',
    example: '2024-01-20T15:45:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: PaperCountDto,
    description: 'Số lượng papers trong folder - từ Prisma `_count`',
  })
  _count?: PaperCountDto;
}

/**
 * Folder with papers DTO
 *
 * @description Folder kèm danh sách papers bên trong - dùng khi xem chi tiết folder.
 */
export class FolderWithPapersDto extends FolderItemDto {
  @ApiProperty({
    type: [PaperItemDto],
    description: 'Danh sách papers trong folder, sắp xếp theo createdAt DESC',
  })
  papers: PaperItemDto[];
}

/**
 * List folders response DTO
 *
 * @description Danh sách tất cả folders của user, sắp xếp theo orderIndex.
 * Dùng cho sidebar library navigation.
 */
export class ListFoldersResponseDto extends ApiResponseDto<FolderItemDto[]> {
  @ApiProperty({
    type: [FolderItemDto],
    description: 'Danh sách folders - có thể rỗng nếu chưa tạo folder nào',
  })
  declare data: FolderItemDto[];
}

/**
 * Get folder response DTO
 *
 * @description Chi tiết folder bao gồm papers bên trong.
 */
export class GetFolderResponseDto extends ApiResponseDto<FolderWithPapersDto> {
  @ApiProperty({ type: FolderWithPapersDto, description: 'Folder với papers' })
  declare data: FolderWithPapersDto;
}

/**
 * Create/Update folder response DTO
 *
 * @description Response khi tạo mới hoặc update folder.
 */
export class FolderResponseDto extends ApiResponseDto<FolderItemDto> {
  @ApiProperty({ type: FolderItemDto, description: 'Thông tin folder' })
  declare data: FolderItemDto;
}

/**
 * Delete folder result DTO
 *
 * @description Kết quả xóa folder. Papers trong folder được chuyển về Uncategorized (không bị xóa).
 */
export class DeleteFolderResultDto {
  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Folder deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Số papers đã được chuyển về Uncategorized (không bị xóa)',
    example: 5,
    minimum: 0,
  })
  deletedPapers: number;
}

/**
 * Delete folder response DTO
 */
export class DeleteFolderResponseDto extends ApiResponseDto<DeleteFolderResultDto> {
  @ApiProperty({
    type: DeleteFolderResultDto,
    description: 'Kết quả xóa folder',
  })
  declare data: DeleteFolderResultDto;
}

/**
 * Move paper result DTO
 *
 * @description Kết quả di chuyển paper sang folder khác hoặc về Uncategorized.
 */
export class MovePaperResultDto {
  @ApiProperty({
    description: 'Paper ID đã di chuyển',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Tên file paper',
    example: 'attention_is_all_you_need.pdf',
  })
  fileName: string;

  @ApiPropertyOptional({
    description: 'RAG file ID để query',
    example: '8fc4b997-0165-41c4-8e5c-f2effa478855',
    format: 'uuid',
  })
  ragFileId?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề paper',
    example: 'Attention Is All You Need',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Folder ID mới - null nếu chuyển về Uncategorized',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
    nullable: true,
  })
  folderId?: string | null;
}

/**
 * Move paper response DTO
 */
export class MovePaperResponseDto extends ApiResponseDto<MovePaperResultDto> {
  @ApiProperty({ type: MovePaperResultDto, description: 'Paper đã di chuyển' })
  declare data: MovePaperResultDto;
}

/**
 * List uncategorized papers response DTO
 *
 * @description Danh sách papers không thuộc folder nào (folder_id = null).
 * Hiển thị trong mục "Uncategorized" của sidebar.
 */
export class ListUncategorizedPapersResponseDto extends ApiResponseDto<
  PaperItemDto[]
> {
  @ApiProperty({
    type: [PaperItemDto],
    description: 'Papers chưa được phân loại vào folder nào',
  })
  declare data: PaperItemDto[];
}
