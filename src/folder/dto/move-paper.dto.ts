import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MovePaperDto {
  @ApiPropertyOptional({
    description: 'Target folder ID (null to remove from folder)',
    example: '8fc4b997-0165-41c4-8e5c-f2effa478855',
  })
  @IsUUID()
  @IsOptional()
  folderId?: string | null;
}
