import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ExplainRegionRequestDto {
  @ApiPropertyOptional({
    description: 'Conversation ID (optional - will create new if not provided)',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({
    description: 'Paper ID (required when conversationId is not provided)',
  })
  @IsOptional()
  @IsUUID()
  paperId?: string;

  @ApiProperty({ description: 'Base64 encoded image of the selected region' })
  @IsString()
  imageBase64: string;

  @ApiPropertyOptional({
    description: 'Page number where the region is located',
  })
  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @ApiPropertyOptional({ description: 'Custom question about the region' })
  @IsOptional()
  @IsString()
  question?: string;
}
