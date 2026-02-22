import { PartialType } from '@nestjs/swagger';
import { CreateFolderDto } from './create-folder.dto';
import { IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFolderDto extends PartialType(CreateFolderDto) {
  @ApiPropertyOptional({
    description: 'Order index for custom sorting',
    example: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  orderIndex?: number;
}
