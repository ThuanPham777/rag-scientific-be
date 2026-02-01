import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreatePaperRequestDto {
  @ApiProperty({ description: 'Original filename' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'S3/Cloud URL of the PDF' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ description: 'MD5 hash for deduplication' })
  @IsOptional()
  @IsString()
  fileHash?: string;
}
