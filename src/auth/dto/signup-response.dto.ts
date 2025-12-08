import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class SignupUserResponseDto {
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

export class SignupResponseDto extends BaseResponseDto<SignupUserResponseDto> {
  @ApiProperty({ type: SignupUserResponseDto })
  user: SignupUserResponseDto;
}
