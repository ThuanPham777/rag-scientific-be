import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from 'src/common/dto';

export class ResetPasswordResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if password reset was successful',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'reset password result message',
    example: 'Password reset successfully',
  })
  declare message: string;
}
