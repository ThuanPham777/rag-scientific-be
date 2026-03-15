import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemConfigModule } from './config/config.module';
import { KbModule } from './kb/kb.module';

@Module({
    imports: [PrismaModule, SystemConfigModule, KbModule],
    controllers: [AdminController],
    providers: [AdminService, AdminBootstrapService],
    exports: [AdminService, SystemConfigModule],
})
export class AdminModule { }
