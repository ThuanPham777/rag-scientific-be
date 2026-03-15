import { Module } from '@nestjs/common';
import { SystemConfigService } from './config.service';
import { SystemConfigController } from './config.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SystemConfigController],
    providers: [SystemConfigService],
    exports: [SystemConfigService],
})
export class SystemConfigModule { }
