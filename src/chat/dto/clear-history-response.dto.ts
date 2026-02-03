// src/chat/dto/clear-history-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from '../../common/dto/api-response.dto';

/**
 * Response for clear chat history operation
 */
export class ClearHistoryResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if history was cleared successfully',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'Result message',
    example: 'Chat history cleared successfully',
  })
  declare message: string;
}
