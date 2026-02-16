import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotebookDto {
  @ApiPropertyOptional({
    description: 'Notebook title',
    example: 'Updated Title',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({
    description: 'Notebook content (HTML from rich text editor)',
  })
  @IsString()
  @IsOptional()
  content?: string;
}
