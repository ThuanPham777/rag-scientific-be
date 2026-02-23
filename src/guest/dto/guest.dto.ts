// src/guest/dto/guest.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// ========== Upload DTOs ==========

/**
 * Guest upload result data
 */
export class GuestUploadResultDto {
  @ApiProperty({ description: 'Paper ID', example: 'uuid-here' })
  paperId: string;

  @ApiProperty({
    description: 'RAG file ID for querying',
    example: 'uuid-here',
  })
  ragFileId: string;

  @ApiProperty({ description: 'Original file name', example: 'paper.pdf' })
  fileName: string;

  @ApiProperty({
    description: 'File URL (S3)',
    example: 'https://bucket.s3.amazonaws.com/paper.pdf',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'Processing status',
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'PROCESSING',
  })
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

/**
 * Guest upload response
 */
export class GuestUploadResponseDto extends ApiResponseDto<GuestUploadResultDto> {
  @ApiProperty({ type: GuestUploadResultDto })
  declare data: GuestUploadResultDto;
}

// ========== Status DTOs ==========

/**
 * Guest ingest status data
 */
export class GuestStatusDataDto {
  @ApiProperty({
    description: 'Processing status',
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

/**
 * Guest status response
 */
export class GuestStatusResponseDto extends ApiResponseDto<GuestStatusDataDto> {
  @ApiProperty({ type: GuestStatusDataDto })
  declare data: GuestStatusDataDto;
}

// ========== Ask Question DTOs ==========

/**
 * Guest ask question request
 */
export class GuestAskQuestionDto {
  @ApiProperty({ description: 'RAG file ID', example: 'uuid-here' })
  @IsString()
  @IsNotEmpty()
  ragFileId: string;

  @ApiProperty({
    description: 'User question',
    example: 'What is the main contribution of this paper?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'Optional image URL for visual questions',
    example: 'https://example.com/image.png',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

/**
 * Guest citation data
 */
export class GuestCitationDto {
  @ApiPropertyOptional({ description: 'Page number', example: 5 })
  pageNumber?: number;

  @ApiPropertyOptional({
    description: 'Text snippet',
    example: 'The model achieves...',
  })
  snippet?: string;

  @ApiPropertyOptional({ description: 'Source ID', example: 'S1' })
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Section title', example: 'Methodology' })
  sectionTitle?: string;

  @ApiPropertyOptional({ description: 'Bounding box coordinates' })
  bbox?: any;

  @ApiPropertyOptional({ description: 'Layout width', example: 612 })
  layoutWidth?: number;

  @ApiPropertyOptional({ description: 'Layout height', example: 792 })
  layoutHeight?: number;
}

/**
 * Guest ask question result
 */
export class GuestAskQuestionResultDto {
  @ApiProperty({
    description: 'AI-generated answer',
    example: 'Based on the paper...',
  })
  answer: string;

  @ApiProperty({ type: [GuestCitationDto], description: 'Source citations' })
  citations: GuestCitationDto[];

  @ApiPropertyOptional({ description: 'Model name', example: 'gpt-4' })
  modelName?: string;

  @ApiPropertyOptional({ description: 'Token count', example: 1500 })
  tokenCount?: number;
}

/**
 * Guest ask question response
 */
export class GuestAskQuestionResponseDto extends ApiResponseDto<GuestAskQuestionResultDto> {
  @ApiProperty({ type: GuestAskQuestionResultDto })
  declare data: GuestAskQuestionResultDto;
}

// ========== Explain Region DTOs ==========

/**
 * Guest explain region request
 */
export class GuestExplainRegionDto {
  @ApiProperty({ description: 'RAG file ID', example: 'uuid-here' })
  @IsString()
  @IsNotEmpty()
  ragFileId: string;

  @ApiProperty({
    description: 'Base64 encoded image of selected region',
    example: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...',
  })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ description: 'Page number', example: 5 })
  @IsNumber()
  @IsOptional()
  pageNumber?: number;

  @ApiPropertyOptional({
    description: 'Optional question about the region',
    example: 'What does this figure show?',
  })
  @IsString()
  @IsOptional()
  question?: string;
}

// ========== Migration DTOs ==========

/**
 * A single chat message from the guest session
 */
export class GuestMigrateMessageDto {
  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant'] })
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Image URL (for explain region messages)',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Model name (assistant messages)' })
  @IsString()
  @IsOptional()
  modelName?: string;

  @ApiPropertyOptional({ description: 'Token count (assistant messages)' })
  @IsNumber()
  @IsOptional()
  tokenCount?: number;

  @ApiPropertyOptional({
    description: 'Citations JSON (assistant messages)',
  })
  @IsOptional()
  citations?: any;

  @ApiPropertyOptional({ description: 'Original created timestamp' })
  @IsString()
  @IsOptional()
  createdAt?: string;
}

/**
 * Guest data migration request - sent after guest logs in
 */
export class GuestMigrateRequestDto {
  @ApiProperty({ description: 'RAG file ID from guest upload' })
  @IsString()
  @IsNotEmpty()
  ragFileId: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File URL (S3)' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'Folder ID to assign paper to (null = unfiled)',
  })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({
    description: 'Chat messages from guest session',
    type: [GuestMigrateMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestMigrateMessageDto)
  messages: GuestMigrateMessageDto[];

  @ApiPropertyOptional({
    description: 'Suggested questions generated during guest session',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  suggestions?: string[];
}

/**
 * Guest migration result data
 */
export class GuestMigrateResultDto {
  @ApiProperty({ description: 'Created paper ID' })
  paperId: string;

  @ApiProperty({ description: 'Created conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'Number of messages migrated' })
  messageCount: number;

  @ApiProperty({ description: 'Number of suggestions migrated' })
  suggestionCount: number;
}

/**
 * Guest migration response
 */
export class GuestMigrateResponseDto extends ApiResponseDto<GuestMigrateResultDto> {
  @ApiProperty({ type: GuestMigrateResultDto })
  declare data: GuestMigrateResultDto;
}
