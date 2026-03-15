import { Module } from '@nestjs/common';
import { KbService } from './kb.service';
import { KbController } from './kb.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [KbController],
    providers: [KbService],
    exports: [KbService],
})
export class KbModule { }
