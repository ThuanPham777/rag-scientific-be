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
import { DeletePaperResponseDto } from './dto/delete-paper-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/jwt.strategy';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Papers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('papers')
export class PaperController {
  constructor(private readonly paperService: PaperService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new paper after uploading PDF' })
  @ApiOkResponse({ type: CreatePaperResponseDto })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
    const data = await this.paperService.createPaper(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Paper created and processing started',
    ) as CreatePaperResponseDto;
  }

  @Get()
  @ApiOperation({ summary: 'List all papers for the user' })
  @ApiOkResponse({ type: ListPapersResponseDto })
  async list(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ListPapersResponseDto> {
    const data = await this.paperService.listMyPapers(user.id);
    return ApiResponseDto.success(
      data,
      'List of papers',
    ) as ListPapersResponseDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get paper details by ID' })
  @ApiParam({ name: 'id', description: 'Paper ID or RAG file_id' })
  @ApiOkResponse({ type: GetPaperResponseDto })
  async get(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<GetPaperResponseDto> {
    const data = await this.paperService.getPaperById(user.id, id);
    return ApiResponseDto.success(data, 'Paper detail') as GetPaperResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a paper' })
  @ApiParam({ name: 'id', description: 'Paper ID' })
  @ApiOkResponse({ type: DeletePaperResponseDto })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<DeletePaperResponseDto> {
    await this.paperService.deletePaper(user.id, id);
    return EmptyResponseDto.success(
      'Paper deleted successfully',
    ) as DeletePaperResponseDto;
  }
}
