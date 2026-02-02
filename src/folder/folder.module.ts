import { Module } from '@nestjs/common';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { S3Service } from '../upload/s3.service';

@Module({
  controllers: [FolderController],
  providers: [FolderService, S3Service],
  exports: [FolderService],
})
export class FolderModule {}
