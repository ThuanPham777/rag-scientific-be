// src/common/dto/api-response.dto.ts
// Unified API response wrapper for all endpoints

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Min } from 'class-validator';

/**
 * Standard API response wrapper
 * All API endpoints should return responses wrapped in this format
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Human-readable message about the result',
    example: 'Operation completed successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Response data payload',
  })
  data?: T;

  constructor(success?: boolean, message?: string, data?: T) {
    this.success = success ?? true;
    this.message = message ?? '';
    this.data = data;
  }

  /**
   * Create a successful response
   */
  static success<T>(data: T, message = 'Success'): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data);
  }

  /**
   * Create an error response
   */
  static error(message: string): ApiResponseDto<null> {
    return new ApiResponseDto(false, message, null);
  }
}

/**
 * Empty response for delete/void operations
 */
export class EmptyResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;

  constructor(success: boolean = true, message: string = 'Success') {
    this.success = success;
    this.message = message;
  }

  static success(message = 'Success'): EmptyResponseDto {
    return new EmptyResponseDto(true, message);
  }
}

/* Cursor pagination */
export class CursorPaginationMeta {
  @ApiProperty({ description: 'Items per request', example: 20 })
  limit: number;

  @ApiProperty({
    description: 'Cursor for next request',
    example: 'ckv123abc',
    nullable: true,
  })
  nextCursor?: string;

  @ApiProperty({
    description: 'Cursor for previous request',
    example: 'ckv122xyz',
    nullable: true,
  })
  prevCursor?: string;

  @ApiProperty({ description: 'Has next page', example: true })
  hasNext: boolean;

  @ApiProperty({ description: 'Has previous page', example: false })
  hasPrev: boolean;

  @ApiProperty({ description: 'Number of returned items', example: 20 })
  count: number;
}

export class CursorPaginationDto<T = any> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty({ type: CursorPaginationMeta })
  pagination: CursorPaginationMeta;

  constructor(
    items: T[],
    limit: number,
    nextCursor?: string,
    prevCursor?: string,
  ) {
    this.items = items;
    this.pagination = {
      limit,
      nextCursor,
      prevCursor,
      hasNext: !!nextCursor,
      hasPrev: !!prevCursor,
      count: items.length,
    };
  }
}

/**
 * ================================
 * Cursor Pagination Request
 * ================================
 */

export class CursorPaginationReqDto {
  @ApiProperty({
    nullable: true,
    required: false,
    description: 'Cursor ID',
  })
  @IsOptional()
  cursor?: string;

  @ApiProperty({
    nullable: true,
    required: false,
    default: 20,
  })
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limit?: number;
}
