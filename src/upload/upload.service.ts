// src/upload/upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadSingleResponseDto } from './dto/upload-single.response.dto';
import { UploadMultiplePdfResponseDto } from './dto/upload-multiple.response.dto';

@Injectable()
export class UploadService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate mimetype basic
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // optional: limit size (ví dụ <= 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File is too large (max 5MB)');
    }

    return this.s3Service.uploadFile(
      file.buffer,
      file.originalname,
      'images', // folder trên S3
      file.mimetype,
    );
  }

  async uploadPdf(file: Express.Multer.File): Promise<UploadSingleResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File is too large (max 50MB)');
    }

    const result = await this.s3Service.uploadFile(
      file.buffer,
      file.originalname,
      'pdf',
      file.mimetype,
    );

    const responseDto: UploadSingleResponseDto = {
      data: result,
      message: 'Upload pdf success',
      success: true,
    };

    return responseDto;
  }

  async uploadMultiplePdf(
    files: Express.Multer.File[],
  ): Promise<UploadMultiplePdfResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Files are required');
    }

    const items: { key: string; url: string }[] = [];

    for (const file of files) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException(`File ${file.originalname} is not a PDF`);
      }

      const result = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        'pdf',
        file.mimetype,
      );

      items.push({
        key: result.key,
        url: result.url,
      });
    }

    return {
      success: true,
      message: 'Upload multiple pdfs success',
      data: {
        count: items.length,
        items,
      },
    };
  }
}
