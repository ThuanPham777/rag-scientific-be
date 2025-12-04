import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum SelectionType {
  AUTO = 'auto',
  FORMULA = 'formula',
  TEXT = 'text',
  FIGURE = 'figure',
  TABLE = 'table',
  UNKNOWN = 'unknown',
}

export enum AudienceLevel {
  NOVICE = 'novice',
  RESEARCHER = 'researcher',
  REVIEWER = 'reviewer',
}

export class ExplainSelectionRequestDto {
  @ApiProperty({ format: 'uuid', description: 'ID của paper' })
  @IsUUID()
  paperId: string;

  @ApiProperty({ format: 'uuid', description: 'ID của page (paper_page)' })
  @IsUUID()
  pageId: string;

  @ApiProperty({
    description:
      'ID của conversation, optional. Nếu không có thì BE có thể tạo conversation mới.',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({ description: 'tọa độ X của bbox (pixel hoặc normalized)' })
  @IsNumber()
  bboxX: number;

  @ApiProperty({ description: 'tọa độ Y của bbox' })
  @IsNumber()
  bboxY: number;

  @ApiProperty({ description: 'chiều rộng bbox' })
  @IsNumber()
  bboxWidth: number;

  @ApiProperty({ description: 'chiều cao bbox' })
  @IsNumber()
  bboxHeight: number;

  @ApiProperty({
    enum: SelectionType,
    default: SelectionType.AUTO,
    description:
      'Loại selection (text, formula, figure...). FE có thể set theo nút user bấm.',
  })
  @IsEnum(SelectionType)
  selectionType: SelectionType = SelectionType.AUTO;

  @ApiProperty({
    enum: AudienceLevel,
    default: AudienceLevel.NOVICE,
    description: 'Đối tượng người đọc (Novice/Researcher/Reviewer)',
  })
  @IsEnum(AudienceLevel)
  audienceLevel: AudienceLevel = AudienceLevel.NOVICE;

  @ApiProperty({
    required: false,
    description:
      'URL ảnh crop (nếu FE đã upload S3 trước). Nếu không có, Python có thể tự crop từ page image_path.',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Text extract được trong vùng (nếu đã có). Python có thể dùng thêm.',
  })
  @IsOptional()
  @IsString()
  extractedText?: string;
}
