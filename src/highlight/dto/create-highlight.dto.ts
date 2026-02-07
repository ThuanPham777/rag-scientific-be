// src/highlight/dto/create-highlight.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  IsEnum,
  MaxLength,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { HighlightColor } from '@prisma/client';

/**
 * Selection rectangle DTO
 * Represents a bounding box for text selection on a PDF page
 */
export class SelectionRectDto {
  @ApiProperty({
    description: 'X coordinate (left) of the selection rectangle',
    example: 100.5,
  })
  @IsNumber()
  x: number;

  @ApiProperty({
    description: 'Y coordinate (top) of the selection rectangle',
    example: 200.3,
  })
  @IsNumber()
  y: number;

  @ApiProperty({
    description: 'Width of the selection rectangle',
    example: 150.0,
  })
  @IsNumber()
  width: number;

  @ApiProperty({
    description: 'Height of the selection rectangle',
    example: 20.0,
  })
  @IsNumber()
  height: number;
}

/**
 * Create highlight request DTO
 */
export class CreateHighlightDto {
  @ApiProperty({
    description: 'Page number where the highlight is located (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  pageNumber: number;

  @ApiProperty({
    type: [SelectionRectDto],
    description:
      'Array of bounding boxes representing the text selection. Multiple rects for multi-line selections.',
    example: [{ x: 100, y: 200, width: 150, height: 20 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionRectDto)
  selectionRects: SelectionRectDto[];

  @ApiProperty({
    description: 'The actual text content that was selected/highlighted',
    example: 'Neural networks have shown remarkable performance...',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  selectedText: string;

  @ApiPropertyOptional({
    description:
      'Text immediately before the selection (for fallback re-rendering)',
    example: 'Recent studies on ',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  textPrefix?: string;

  @ApiPropertyOptional({
    description:
      'Text immediately after the selection (for fallback re-rendering)',
    example: ' in various domains.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  textSuffix?: string;

  @ApiPropertyOptional({
    enum: HighlightColor,
    description: 'Highlight color',
    default: 'YELLOW',
    example: 'YELLOW',
  })
  @IsOptional()
  @IsEnum(HighlightColor)
  color?: HighlightColor;
}
