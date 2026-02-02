// src/guest/guest.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    HttpModule,
    UploadModule, // For S3Service
  ],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
