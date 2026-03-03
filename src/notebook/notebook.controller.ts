import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotebookService } from './notebook.service';
import { CreateNotebookDto, UpdateNotebookDto } from './dto/index';
import {
  ListNotebooksResponseDto,
  NotebookResponseDto,
  DeleteNotebookResponseDto,
} from './dto/notebook-response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('notebooks')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notebooks')
export class NotebookController {
  constructor(private readonly notebookService: NotebookService) { }

  @Get()
  @ApiOperation({ summary: 'Get all notebooks owned by current user' })
  @ApiOkResponse({ type: ListNotebooksResponseDto })
  async findAll(@Request() req: any): Promise<ListNotebooksResponseDto> {
    const data = await this.notebookService.findAllByUser(req.user.id);
    return ApiResponseDto.success(
      data,
      'List of notebooks',
    ) as ListNotebooksResponseDto;
  }

  // NOTE: This route must be declared BEFORE ":id" routes to avoid conflicts
  @Get('shared-with-me')
  @ApiOperation({ summary: 'Get notebooks shared with the current user' })
  async getSharedWithMe(@Request() req: any) {
    const data = await this.notebookService.getSharedWithMe(req.user.id);
    return ApiResponseDto.success(data, 'Notebooks shared with you');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notebook with full content' })
  @ApiParam({ name: 'id', description: 'Notebook ID' })
  @ApiOkResponse({ type: NotebookResponseDto })
  @ApiResponse({ status: 404, description: 'Notebook not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<NotebookResponseDto> {
    const data = await this.notebookService.findOne(id, req.user.id);
    return ApiResponseDto.success(
      data,
      'Notebook details',
    ) as NotebookResponseDto;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notebook' })
  @ApiOkResponse({ type: NotebookResponseDto })
  async create(
    @Body() dto: CreateNotebookDto,
    @Request() req: any,
  ): Promise<NotebookResponseDto> {
    const data = await this.notebookService.create(req.user.id, dto);
    return ApiResponseDto.success(
      data,
      'Notebook created',
    ) as NotebookResponseDto;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a notebook (auto-save)' })
  @ApiParam({ name: 'id', description: 'Notebook ID' })
  @ApiOkResponse({ type: NotebookResponseDto })
  @ApiResponse({ status: 404, description: 'Notebook not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNotebookDto,
    @Request() req: any,
  ): Promise<NotebookResponseDto> {
    const data = await this.notebookService.update(id, req.user.id, dto);
    return ApiResponseDto.success(
      data,
      'Notebook updated',
    ) as NotebookResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notebook (owner) or hide it (collaborator)' })
  @ApiParam({ name: 'id', description: 'Notebook ID' })
  @ApiOkResponse({ type: DeleteNotebookResponseDto })
  @ApiResponse({ status: 404, description: 'Notebook not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<DeleteNotebookResponseDto> {
    const data = await this.notebookService.remove(id, req.user.id);
    return ApiResponseDto.success(
      data,
      data.message,
    ) as DeleteNotebookResponseDto;
  }

  // =========================================================================
  // COLLABORATION ENDPOINTS
  // =========================================================================

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a notebook (creates a collaborative copy)' })
  @ApiParam({ name: 'id', description: 'Notebook ID to share' })
  async share(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const data = await this.notebookService.shareNotebook(id, req.user.id);
    return ApiResponseDto.success(data, 'Notebook shared');
  }

  @Post('join/:token')
  @ApiOperation({ summary: 'Join a shared notebook via invite token' })
  @ApiParam({ name: 'token', description: 'Share token' })
  async joinByToken(
    @Param('token') token: string,
    @Request() req: any,
  ) {
    const data = await this.notebookService.joinByToken(token, req.user.id);
    return ApiResponseDto.success(data, 'Joined notebook');
  }

  @Get('collab/:id')
  @ApiOperation({ summary: 'Get a collaborative notebook (any collaborator)' })
  @ApiParam({ name: 'id', description: 'Collaborative notebook ID' })
  async findCollaborative(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const data = await this.notebookService.findCollaborative(id, req.user.id);
    return ApiResponseDto.success(data, 'Collaborative notebook');
  }

  @Put('collab/:id')
  @ApiOperation({ summary: 'Update a collaborative notebook' })
  @ApiParam({ name: 'id', description: 'Collaborative notebook ID' })
  async updateCollaborative(
    @Param('id') id: string,
    @Body() dto: UpdateNotebookDto,
    @Request() req: any,
  ) {
    const data = await this.notebookService.updateCollaborative(
      id,
      req.user.id,
      dto,
    );
    return ApiResponseDto.success(data, 'Collaborative notebook updated');
  }
}
