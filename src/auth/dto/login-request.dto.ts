import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Login request DTO for local (email/password) authentication
 *
 * @description Đăng nhập bằng email và mật khẩu đã đăng ký.
 * Cho OAuth (Google), sử dụng endpoint `/auth/google/code` thay thế.
 */
export class LoginRequestDto {
  @ApiProperty({
    description:
      'Email đăng nhập - phải là email đã đăng ký trong hệ thống với provider LOCAL',
    example: 'researcher@university.edu',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Mật khẩu tài khoản - tối thiểu 6 ký tự. Hash bằng bcrypt trước khi lưu.',
    example: 'SecureP@ss123',
    minLength: 6,
    format: 'password',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
