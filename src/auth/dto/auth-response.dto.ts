import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty({ description: 'User ID', example: 'uuid-here' })
    id: string;

    @ApiProperty({ description: 'User email', example: 'user@example.com' })
    email: string;

    @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
    displayName?: string;

    @ApiProperty({ description: 'User role', example: 'USER', enum: ['USER', 'ADMIN'] })
    role: string;
}

export class AuthResponseDto {
    @ApiProperty({ description: 'User information', type: UserResponseDto })
    user: UserResponseDto;

    @ApiProperty({ description: 'JWT access token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    accessToken: string;

    @ApiProperty({ description: 'JWT refresh token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    refreshToken: string;
}

export class LogoutResponseDto {
    @ApiProperty({ description: 'Logout success status', example: true })
    success: boolean;
}

