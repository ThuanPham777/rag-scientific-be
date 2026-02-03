// src/auth/dto/login-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * User data returned in login response
 *
 * @description Thông tin cơ bản của user sau khi đăng nhập/đăng ký thành công.
 * Bao gồm profile info và authentication provider.
 */
export class UserDto {
  @ApiProperty({
    description: 'User ID (UUID v4) - Primary key trong database',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Email đăng nhập - unique trong hệ thống',
    example: 'researcher@university.edu',
    format: 'email',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị - có thể từ Google profile hoặc tự đặt',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  displayName?: string;

  @ApiPropertyOptional({
    description:
      'URL avatar - từ Google profile hoặc upload. Dùng cho hiển thị UI.',
    example: 'https://lh3.googleusercontent.com/a/ACg8ocJ...',
    format: 'uri',
  })
  avatarUrl?: string;

  @ApiProperty({
    description:
      'Phương thức xác thực - LOCAL (email/password) hoặc GOOGLE (OAuth 2.0)',
    example: 'GOOGLE',
    enum: ['LOCAL', 'GOOGLE'],
    enumName: 'AuthProvider',
  })
  provider: string;
}

// Alias for backward compatibility
export { UserDto as LoginUserResponseDto };

/**
 * Raw login result from service (with tokens)
 *
 * @description Kết quả trả về từ AuthService.login() bao gồm cả tokens.
 * Service trả raw data, Controller wrap thành response format.
 */
export class LoginResultDto {
  @ApiProperty({
    type: UserDto,
    description: 'Thông tin user đã đăng nhập',
  })
  user: UserDto;

  @ApiProperty({
    description:
      'JWT Access Token - dùng cho Authorization header. Hết hạn sau 15 phút.',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNzA...',
    format: 'jwt',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'JWT Refresh Token - dùng để lấy access token mới. Hết hạn sau 7 ngày. Lưu HttpOnly cookie.',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNzA...',
    format: 'jwt',
  })
  refreshToken: string;
}

/**
 * Login response DTO (for Swagger documentation)
 *
 * @description Response trả về khi đăng nhập/đăng ký thành công.
 * Bao gồm user info và JWT tokens để authenticate các request tiếp theo.
 */
export class LoginResponseDto extends ApiResponseDto<UserDto> {
  @ApiProperty({
    description:
      'JWT Access Token - gửi trong header `Authorization: Bearer <token>` cho các request cần auth',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNzA...',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'JWT Refresh Token - gọi `/auth/refresh` khi access token hết hạn để lấy token mới',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNzA...',
  })
  refreshToken: string;

  @ApiProperty({ type: UserDto, description: 'Thông tin user đã đăng nhập' })
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
