// src/selection/selection.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SelectionController } from './selection.controller';
import { SelectionService } from './selection.service';

@Module({
  imports: [HttpModule],
  controllers: [SelectionController],
  providers: [SelectionService],
  exports: [SelectionService],
})
export class SelectionModule {}
