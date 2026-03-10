import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Avatar URL', maxLength: 500 })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  avatarUrl?: string;
}
