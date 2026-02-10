// src/highlight/dto/update-highlight.dto.ts
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HighlightColor } from '../../../generated/prisma/client';

/**
 * Update highlight request DTO
 * Only color can be updated (selection data is immutable)
 */
export class UpdateHighlightDto {
  @ApiPropertyOptional({
    enum: HighlightColor,
    description: 'New highlight color',
    example: 'GREEN',
  })
  @IsOptional()
  @IsEnum(HighlightColor)
  color?: HighlightColor;
}
