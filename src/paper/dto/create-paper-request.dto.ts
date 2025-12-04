import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePaperRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'S3 key của PDF' })
  @IsString()
  filePath: string;

  @ApiProperty({ description: 'CloudFront URL để FE load PDF' })
  @IsString()
  fileUrl: string;
}
