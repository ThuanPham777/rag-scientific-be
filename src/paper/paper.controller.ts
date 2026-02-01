// src/paper/paper.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaperService } from './paper.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { CreatePaperResponseDto } from './dto/create-paper-response.dto';
import { ListPapersResponseDto } from './dto/list-papers-response.dto';
import { GetPaperResponseDto } from './dto/get-paper-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/jwt.strategy';

@ApiTags('Papers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('papers')
export class PaperController {
  constructor(private readonly paperService: PaperService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new paper after uploading PDF' })
  @ApiOkResponse({ type: CreatePaperResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
    return this.paperService.createPaper(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all papers for the user' })
  @ApiOkResponse({ type: ListPapersResponseDto })
  list(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ListPapersResponseDto> {
    return this.paperService.listMyPapers(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get paper details by ID' })
  @ApiParam({ name: 'id', description: 'Paper ID or RAG file_id' })
  @ApiOkResponse({ type: GetPaperResponseDto })
  get(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<GetPaperResponseDto> {
    return this.paperService.getPaperById(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a paper' })
  @ApiParam({ name: 'id', description: 'Paper ID' })
  delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.paperService.deletePaper(user.id, id);
  }
}
