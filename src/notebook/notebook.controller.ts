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
  constructor(private readonly notebookService: NotebookService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notebooks for current user' })
  @ApiOkResponse({ type: ListNotebooksResponseDto })
  async findAll(@Request() req: any): Promise<ListNotebooksResponseDto> {
    const data = await this.notebookService.findAllByUser(req.user.id);
    return ApiResponseDto.success(
      data,
      'List of notebooks',
    ) as ListNotebooksResponseDto;
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
  @ApiOperation({ summary: 'Delete a notebook' })
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
      'Notebook deleted successfully',
    ) as DeleteNotebookResponseDto;
  }
}
