// src/auth/dto/logout-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from '../../common/dto/api-response.dto';

/**
 * Response for logout operations
 */
export class LogoutResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if logout was successful',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'Logout result message',
    example: 'Logged out successfully',
  })
  declare message: string;
}
