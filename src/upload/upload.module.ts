// src/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Service } from './s3.service';
import * as multer from 'multer';

@Module({
    imports: [
        ConfigModule,
        MulterModule.register({
            // Chỉ dùng in-memory vì ta upload thẳng lên S3
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB max, tùy chỉnh
            },
        }),
    ],
    controllers: [UploadController],
    providers: [UploadService, S3Service],
    exports: [UploadService, S3Service],
})
export class UploadModule { }
