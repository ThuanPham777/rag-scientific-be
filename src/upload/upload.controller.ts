// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { UploadSingleResponseDto } from './dto/upload-single.response.dto';
import { UploadMultiplePdfResponseDto } from './dto/upload-multiple.response.dto';

@ApiTags('Upload')
@Controller('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload 1 image' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UploadSingleResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadImage(file);
    return result;
  }

  @Post('pdf')
  @ApiOperation({ summary: 'Upload 1 PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UploadSingleResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadPdf(file);
    return result;
  }

  @Post('pdfs')
  @ApiOperation({ summary: 'Upload multiple PDFs' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UploadMultiplePdfResponseDto })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultiplePdf(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await this.uploadService.uploadMultiplePdf(files);

    return results;
  }
}
