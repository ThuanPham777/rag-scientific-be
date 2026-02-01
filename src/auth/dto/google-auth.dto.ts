import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID token from frontend',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
