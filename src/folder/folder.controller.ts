import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { FolderService } from './folder.service';
import { CreateFolderDto, UpdateFolderDto, MovePaperDto } from './dto/index';
import {
  ListFoldersResponseDto,
  GetFolderResponseDto,
  FolderResponseDto,
  DeleteFolderResponseDto,
  MovePaperResponseDto,
  ListUncategorizedPapersResponseDto,
} from './dto/folder-response.dto';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('folders')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'Get all folders for current user' })
  @ApiOkResponse({ type: ListFoldersResponseDto })
  async findAll(@Request() req: any): Promise<ListFoldersResponseDto> {
    const data = await this.folderService.findAllByUser(req.user.id);
    return ApiResponseDto.success(
      data,
      'List of folders',
    ) as ListFoldersResponseDto;
  }

  @Get('uncategorized')
  @ApiOperation({ summary: 'Get papers without folder (uncategorized)' })
  @ApiOkResponse({ type: ListUncategorizedPapersResponseDto })
  async getUncategorized(
    @Request() req: any,
  ): Promise<ListUncategorizedPapersResponseDto> {
    const data = await this.folderService.getUncategorizedPapers(req.user.id);
    return ApiResponseDto.success(
      data,
      'Uncategorized papers',
    ) as ListUncategorizedPapersResponseDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a folder with its papers' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiOkResponse({ type: GetFolderResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<GetFolderResponseDto> {
    const data = await this.folderService.findOne(id, req.user.id);
    return ApiResponseDto.success(
      data,
      'Folder details',
    ) as GetFolderResponseDto;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiOkResponse({ type: FolderResponseDto })
  @ApiResponse({ status: 409, description: 'Folder name already exists' })
  async create(
    @Body() dto: CreateFolderDto,
    @Request() req: any,
  ): Promise<FolderResponseDto> {
    const data = await this.folderService.create(req.user.id, dto);
    return ApiResponseDto.success(data, 'Folder created') as FolderResponseDto;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiOkResponse({ type: FolderResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 409, description: 'Folder name already exists' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @Request() req: any,
  ): Promise<FolderResponseDto> {
    const data = await this.folderService.update(id, req.user.id, dto);
    return ApiResponseDto.success(data, 'Folder updated') as FolderResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiOkResponse({ type: DeleteFolderResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<DeleteFolderResponseDto> {
    const data = await this.folderService.remove(id, req.user.id);
    return ApiResponseDto.success(
      data,
      'Folder deleted successfully',
    ) as DeleteFolderResponseDto;
  }

  @Patch('papers/:paperId/move')
  @ApiOperation({ summary: 'Move a paper to a folder (or remove from folder)' })
  @ApiParam({ name: 'paperId', description: 'Paper ID' })
  @ApiOkResponse({ type: MovePaperResponseDto })
  @ApiResponse({ status: 404, description: 'Paper or folder not found' })
  async movePaper(
    @Param('paperId') paperId: string,
    @Body() dto: MovePaperDto,
    @Request() req: any,
  ): Promise<MovePaperResponseDto> {
    const data = await this.folderService.movePaper(paperId, req.user.id, dto);
    const message = dto.folderId
      ? 'Paper moved to folder'
      : 'Paper removed from folder';
    return ApiResponseDto.success(data, message) as MovePaperResponseDto;
  }
}
