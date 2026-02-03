// src/conversation/dto/delete-conversation-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from '../../common/dto/api-response.dto';

/**
 * Response for delete conversation operation
 */
export class DeleteConversationResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if deletion was successful',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'Deletion result message',
    example: 'Conversation deleted successfully',
  })
  declare message: string;
}
