// src/cleanup/cleanup.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CleanupService } from './cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, HttpModule, UploadModule],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
