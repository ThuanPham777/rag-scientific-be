import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaperController } from './paper.controller';
import { PaperService } from './paper.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [PaperController],
  providers: [PaperService],
  exports: [PaperService],
})
export class PaperModule {}
