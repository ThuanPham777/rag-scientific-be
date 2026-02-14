// src/session/dto/create-invite.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateInviteDto {
  @ApiPropertyOptional({
    description: 'Hours until invite expires (default 48)',
    default: 48,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720) // 30 days
  expiresInHours?: number;

  @ApiPropertyOptional({
    description: 'Max uses for this invite (0 = unlimited)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxUses?: number;
}
