// src/common/dto/api-response.dto.ts
// Unified API response wrapper for all endpoints

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

/**
 * Pagination metadata
 */
export class PaginationMeta {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;

  @ApiProperty({ description: 'Has next page', example: true })
  hasNext: boolean;

  @ApiProperty({ description: 'Has previous page', example: false })
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export class PaginatedResponseDto<T> extends ApiResponseDto<T[]> {
  @ApiProperty({ type: PaginationMeta })
  pagination: PaginationMeta;
}
