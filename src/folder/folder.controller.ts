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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FolderService } from './folder.service';
import { CreateFolderDto, UpdateFolderDto, MovePaperDto } from './dto';

@ApiTags('folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'Get all folders for current user' })
  @ApiResponse({ status: 200, description: 'List of folders' })
  findAll(@Request() req: any) {
    return this.folderService.findAllByUser(req.user.id);
  }

  @Get('uncategorized')
  @ApiOperation({ summary: 'Get papers without folder (uncategorized)' })
  @ApiResponse({ status: 200, description: 'List of uncategorized papers' })
  getUncategorized(@Request() req: any) {
    return this.folderService.getUncategorizedPapers(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a folder with its papers' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder details with papers' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.folderService.findOne(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({ status: 201, description: 'Folder created' })
  @ApiResponse({ status: 409, description: 'Folder name already exists' })
  create(@Body() dto: CreateFolderDto, @Request() req: any) {
    return this.folderService.create(req.user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder updated' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 409, description: 'Folder name already exists' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @Request() req: any,
  ) {
    return this.folderService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder deleted (papers are NOT deleted)',
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.folderService.remove(id, req.user.id);
  }

  @Patch('papers/:paperId/move')
  @ApiOperation({ summary: 'Move a paper to a folder (or remove from folder)' })
  @ApiParam({ name: 'paperId', description: 'Paper ID' })
  @ApiResponse({ status: 200, description: 'Paper moved' })
  @ApiResponse({ status: 404, description: 'Paper or folder not found' })
  movePaper(
    @Param('paperId') paperId: string,
    @Body() dto: MovePaperDto,
    @Request() req: any,
  ) {
    return this.folderService.movePaper(paperId, req.user.id, dto);
  }
}
