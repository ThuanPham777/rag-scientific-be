// src/paper/paper.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaperService } from './paper.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { CreatePaperResponseDto } from './dto/create-paper-response.dto';
import { ListPapersResponseDto } from './dto/list-papers-response.dto';
import { GetPaperResponseDto } from './dto/get-paper-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Papers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('papers')
export class PaperController {
  constructor(private readonly paperService: PaperService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo paper mới sau khi upload PDF' })
  @ApiOkResponse({ type: CreatePaperResponseDto })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
    return this.paperService.createPaper(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách paper của user' })
  @ApiOkResponse({ type: ListPapersResponseDto })
  list(@CurrentUser() user: any): Promise<ListPapersResponseDto> {
    return this.paperService.listMyPapers(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 paper của user' })
  @ApiOkResponse({ type: GetPaperResponseDto })
  get(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<GetPaperResponseDto> {
    return this.paperService.getPaperById(user.id, id);
  }
}
