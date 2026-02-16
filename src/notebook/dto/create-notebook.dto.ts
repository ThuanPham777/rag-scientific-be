import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotebookDto {
  @ApiPropertyOptional({
    description: 'Notebook title',
    example: 'My Research Notes',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({
    description: 'Initial content (HTML)',
    example: '<p>Start writing...</p>',
  })
  @IsString()
  @IsOptional()
  content?: string;
}
