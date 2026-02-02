// src/guest/dto/guest-upload.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class GuestUploadResultDto {
  @ApiProperty({ description: 'Paper ID' })
  paperId: string;

  @ApiProperty({ description: 'RAG file ID for querying' })
  ragFileId: string;

  @ApiProperty({ description: 'Original file name' })
  fileName: string;

  @ApiProperty({ description: 'File URL (S3)' })
  fileUrl: string;

  @ApiProperty({
    description: 'Processing status',
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
  })
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export class GuestUploadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: GuestUploadResultDto })
  data: GuestUploadResultDto;
}

export class GuestAskQuestionDto {
  @ApiProperty({ description: 'RAG file ID' })
  @IsString()
  @IsNotEmpty()
  ragFileId: string;

  @ApiProperty({ description: 'User question' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Optional image URL', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class GuestCitationDto {
  @ApiProperty({ required: false })
  pageNumber?: number;

  @ApiProperty({ required: false })
  snippet?: string;

  @ApiProperty({ required: false })
  sourceId?: string;

  @ApiProperty({ required: false })
  sectionTitle?: string;

  @ApiProperty({ required: false })
  bbox?: any;

  @ApiProperty({ required: false })
  layoutWidth?: number;

  @ApiProperty({ required: false })
  layoutHeight?: number;
}

export class GuestAskQuestionResultDto {
  @ApiProperty({ description: 'AI answer' })
  answer: string;

  @ApiProperty({ type: [GuestCitationDto], description: 'Citations' })
  citations: GuestCitationDto[];

  @ApiProperty({ required: false })
  modelName?: string;

  @ApiProperty({ required: false })
  tokenCount?: number;
}

export class GuestAskQuestionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: GuestAskQuestionResultDto })
  data: GuestAskQuestionResultDto;
}

export class GuestExplainRegionDto {
  @ApiProperty({ description: 'RAG file ID' })
  @IsString()
  @IsNotEmpty()
  ragFileId: string;

  @ApiProperty({ description: 'Base64 encoded image of selected region' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiProperty({ description: 'Page number', required: false })
  @IsNumber()
  @IsOptional()
  pageNumber?: number;

  @ApiProperty({
    description: 'Optional question about the region',
    required: false,
  })
  @IsString()
  @IsOptional()
  question?: string;
}
