import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from '../../common/dto/base-response.dto';

export class LoginUserResponseDto {
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

export class LoginResponseDto extends BaseResponseDto<LoginUserResponseDto> {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: LoginUserResponseDto })
  declare data: LoginUserResponseDto;
}
