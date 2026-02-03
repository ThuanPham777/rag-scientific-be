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
import { UploadSingleResponseDto } from './dto/upload-single.response.dto';
import { UploadMultiplePdfResponseDto } from './dto/upload-multiple.response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

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
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadSingleResponseDto> {
    const data = await this.uploadService.uploadImage(file);
    return ApiResponseDto.success(
      data,
      'Image uploaded successfully',
    ) as UploadSingleResponseDto;
  }

  @Post('pdf')
  @ApiOperation({ summary: 'Upload 1 PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UploadSingleResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadSingleResponseDto> {
    const data = await this.uploadService.uploadPdf(file);
    return ApiResponseDto.success(
      data,
      'Upload pdf success',
    ) as UploadSingleResponseDto;
  }

  @Post('pdfs')
  @ApiOperation({ summary: 'Upload multiple PDFs' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UploadMultiplePdfResponseDto })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultiplePdf(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadMultiplePdfResponseDto> {
    const data = await this.uploadService.uploadMultiplePdf(files);
    return ApiResponseDto.success(
      data,
      'Upload multiple pdfs success',
    ) as UploadMultiplePdfResponseDto;
  }
}
