import { ApiProperty } from '@nestjs/swagger';
import { EmptyResponseDto } from 'src/common/dto';

export class ForgotPasswordResultDto {}

export class ForgotPasswordResponseDto extends EmptyResponseDto {
  @ApiProperty({
    description: 'Indicates if reset password email was sent successfully',
    example: true,
  })
  declare success: boolean;

  @ApiProperty({
    description: 'Reset password email result message',
    example: 'Password reset email sent successfully',
  })
  declare message: string;
}
