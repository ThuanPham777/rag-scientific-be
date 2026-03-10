import { ApiProperty } from '@nestjs/swagger';

export class SearchPaperDto {
  @ApiProperty() id: string;
  @ApiProperty() fileName: string;
  @ApiProperty({ required: false }) title?: string;
}

export class SearchSessionDto {
  @ApiProperty() id: string;
  @ApiProperty({ required: false }) title?: string;
  @ApiProperty({ enum: ['SINGLE_PAPER', 'MULTI_PAPER', 'GROUP'] })
  type: string;
  @ApiProperty() isCollaborative: boolean;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [SearchPaperDto] }) papers: SearchPaperDto[];
}

export class SearchNotebookDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ required: false }) contentPreview?: string;
}

export class SearchResultDto {
  @ApiProperty({ type: [SearchSessionDto] }) sessions: SearchSessionDto[];
  @ApiProperty({ type: [SearchNotebookDto] }) notebooks: SearchNotebookDto[];
}
