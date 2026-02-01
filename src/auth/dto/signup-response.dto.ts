import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from '../../common/dto/base-response.dto';

export class SignupUserResponseDto {
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

export class SignupResponseDto extends BaseResponseDto<SignupUserResponseDto> {
  @ApiProperty({ type: SignupUserResponseDto })
  declare data: SignupUserResponseDto;
}
