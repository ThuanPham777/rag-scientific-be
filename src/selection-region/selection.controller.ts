// src/selection/selection.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SelectionService } from './selection.service';
import { ExplainSelectionRequestDto } from './dto/explain-selection-request.dto';
import { ExplainSelectionResponseDto } from './dto/explain-selection-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Selection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('selections')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  @Post('explain')
  @ApiOperation({
    summary: 'Giải thích một vùng được crop trên PDF',
    description:
      'User crop bất kỳ vùng nào (text, formula, hình...). BE lưu selection_region, gọi Python RAG xử lý và trả answer.',
  })
  @ApiOkResponse({ type: ExplainSelectionResponseDto })
  explainSelection(
    @CurrentUser() user: any,
    @Body() dto: ExplainSelectionRequestDto,
  ): Promise<ExplainSelectionResponseDto> {
    return this.selectionService.explainSelection(user.id, dto);
  }
}
