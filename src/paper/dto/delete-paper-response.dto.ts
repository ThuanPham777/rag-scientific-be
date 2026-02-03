// src/paper/dto/delete-paper-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from '../../common/dto/api-response.dto';

/**
 * Response for delete paper operation
 */
export class DeletePaperResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if deletion was successful',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'Deletion result message',
    example: 'Paper deleted successfully',
  })
  declare message: string;
}
