import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GoogleCodeAuthDto {
  @ApiProperty({
    description: 'Authorization code from Google OAuth redirect',
    example: '4/0AX4XfWh...',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description:
      'Redirect URI used in the OAuth flow (must match the one registered in Google Console)',
    example: 'http://localhost:5173/auth/google/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @ApiProperty({
    description: 'Code verifier for PKCE (optional but recommended)',
    required: false,
  })
  @IsString()
  @IsOptional()
  codeVerifier?: string;
}
