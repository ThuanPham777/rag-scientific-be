import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class LoginUserResponseDto {
  @ApiProperty({ description: 'User ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  displayName?: string;

  @ApiProperty({
    description: 'User role',
    example: 'USER',
    enum: ['USER', 'ADMIN'],
  })
  role: string;
}

export class LoginResponseDto extends BaseResponseDto<LoginUserResponseDto> {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: LoginUserResponseDto })
  declare data: LoginUserResponseDto;
}
