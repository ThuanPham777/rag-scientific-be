// src/paper/dto/list-papers-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaperItemDto } from './create-paper-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * List papers response DTO
 *
 * @description Danh sách tất cả papers của user, sắp xếp theo createdAt DESC.
 * Dùng cho sidebar library và paper management.
 */
export class ListPapersResponseDto extends ApiResponseDto<PaperItemDto[]> {
  @ApiProperty({
    type: [PaperItemDto],
    description:
      'Danh sách papers - có thể rỗng nếu user chưa upload paper nào',
  })
  declare data: PaperItemDto[];
}
