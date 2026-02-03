// src/auth/dto/login-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * User data returned in login response
 */
export class UserDto {
  @ApiProperty({ description: 'User ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Auth provider',
    example: 'LOCAL',
    enum: ['LOCAL', 'GOOGLE'],
  })
  provider: string;
}

// Alias for backward compatibility
export { UserDto as LoginUserResponseDto };

/**
 * Raw login result from service (with tokens)
 */
export class LoginResultDto {
  @ApiProperty({ type: UserDto, description: 'User data' })
  user: UserDto;

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

/**
 * Login response DTO (for Swagger documentation)
 */
export class LoginResponseDto extends ApiResponseDto<UserDto> {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({ type: UserDto })
  declare data: UserDto;

  /**
   * Create login response from raw result
   */
  static fromResult(result: LoginResultDto, message: string): LoginResponseDto {
    const response = new LoginResponseDto();
    response.success = true;
    response.message = message;
    response.data = result.user;
    response.accessToken = result.accessToken;
    response.refreshToken = result.refreshToken;
    return response;
  }
}
