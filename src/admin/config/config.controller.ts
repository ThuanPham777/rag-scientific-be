import {
    Controller,
    Get,
    Patch,
    Post,
    Param,
    Body,
    UseGuards,
    Req,
    NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SystemConfigService } from './config.service';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class SystemConfigController {
    constructor(private readonly configService: SystemConfigService) { }

    /**
     * GET /admin/config — list all system configs
     */
    @Get()
    async getAll() {
        const configs = await this.configService.getAll();
        return { success: true, data: configs };
    }

    /**
     * GET /admin/config/llm-models — available LLM models per provider
     */
    @Get('llm-models')
    getAvailableModels() {
        const models = this.configService.getAvailableModels();
        return { success: true, data: models };
    }

    /**
     * PATCH /admin/config/:key — update a config value
     */
    @Patch(':key')
    async update(
        @Param('key') key: string,
        @Body('value') value: any,
        @Req() req: any,
    ) {
        const userId = req.user?.id;
        const updated = await this.configService.update(key, value, userId);
        return { success: true, data: updated };
    }

    /**
     * POST /admin/config/restore-default/:key — restore a config to its default value
     */
    @Post('restore-default/:key')
    async restoreDefault(
        @Param('key') key: string,
        @Req() req: any,
    ) {
        const defaultConfig = this.configService.getDefault(key);
        if (!defaultConfig) {
            throw new NotFoundException(`No default found for key "${key}"`);
        }
        const userId = req.user?.id;
        const updated = await this.configService.update(key, defaultConfig.value, userId);
        return { success: true, data: updated };
    }
}
