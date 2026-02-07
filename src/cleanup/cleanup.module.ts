// src/cleanup/cleanup.module.ts
import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
