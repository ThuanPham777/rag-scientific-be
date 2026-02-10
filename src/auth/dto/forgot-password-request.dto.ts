import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({
    description: 'Email address of the user requesting password reset',
    example: 'researcher@university.edu',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
