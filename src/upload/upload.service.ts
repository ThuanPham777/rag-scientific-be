// src/upload/upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from './s3.service';

@Injectable()
export class UploadService {
    constructor(private readonly s3Service: S3Service) { }

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

    async uploadPdf(file: Express.Multer.File) {
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

        return this.s3Service.uploadFile(
            file.buffer,
            file.originalname,
            'pdf',
            file.mimetype,
        );
    }

    async uploadMultiplePdf(files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Files are required');
        }

        const results = [];

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

            results.push(result);
        }

        return results;
    }
}
