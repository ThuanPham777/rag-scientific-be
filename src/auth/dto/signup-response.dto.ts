// src/auth/dto/signup-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * User data returned in signup response
 */
export class SignupUserResultDto {
  @ApiProperty({ description: 'User ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  displayName?: string;

  @ApiProperty({
    description: 'Auth provider',
    example: 'LOCAL',
    enum: ['LOCAL', 'GOOGLE'],
  })
  provider: string;
}

/**
 * Signup response DTO (for Swagger documentation)
 */
export class SignupResponseDto extends ApiResponseDto<SignupUserResultDto> {
  @ApiProperty({ type: SignupUserResultDto })
  declare data: SignupUserResultDto;

  /**
   * Create signup response from raw user data
   */
  static fromUser(
    user: SignupUserResultDto,
    message: string,
  ): SignupResponseDto {
    const response = new SignupResponseDto();
    response.success = true;
    response.message = message;
    response.data = user;
    return response;
  }
}
