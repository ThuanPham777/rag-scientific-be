import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UsageService } from './usage/usage.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN' as any)
@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly usageService: UsageService,
    ) { }

    // ============================================================
    // DASHBOARD STATS
    // ============================================================

    @Get('stats')
    @ApiOperation({ summary: '[ADMIN] Get system-wide dashboard statistics' })
    @ApiQuery({
        name: 'days',
        required: false,
        description: 'Range in days (default: 7)',
        example: 7,
    })
    async getStats(@Query('days') days?: string) {
        const rangeDays = days ? parseInt(days, 10) : 7;
        const stats = await this.adminService.getSystemStats(rangeDays);
        return { success: true, data: stats };
    }

    @Get('stats/recent-users')
    @ApiOperation({ summary: '[ADMIN] Get recent user registrations' })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getRecentUsers(@Query('limit') limit?: string) {
        const data = await this.adminService.getRecentUsers(
            limit ? parseInt(limit, 10) : 10,
        );
        return { success: true, data };
    }

    @Get('usage-stats')
    @ApiOperation({ summary: '[ADMIN] Get LLM usage statistics for dashboard' })
    @ApiQuery({
        name: 'days',
        required: false,
        description: 'Range in days (default: 7)',
        example: 7,
    })
    async getUsageStats(@Query('days') days?: string) {
        const rangeDays = days ? parseInt(days, 10) : 7;
        const data = await this.usageService.getUsageStats(rangeDays);
        return { success: true, data };
    }

    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    @Get('users')
    @ApiOperation({ summary: '[ADMIN] Get paginated list of all users' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    async getUsers(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
    ) {
        const data = await this.adminService.getUsers({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            search,
            isActive:
                isActive !== undefined ? isActive === 'true' : undefined,
        });
        return { success: true, ...data };
    }

    @Get('users/:id')
    @ApiOperation({ summary: '[ADMIN] Get a user detail with stats' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
        const data = await this.adminService.getUserDetail(id);
        return { success: true, data };
    }

    @Get('users/:id/papers')
    @ApiOperation({ summary: '[ADMIN] Get papers uploaded by a user' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    async getUserPapers(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const data = await this.adminService.getUserPapers(
            id,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
        return { success: true, ...data };
    }

    @Post('users')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '[ADMIN] Create a new user' })
    async createUser(
        @Body() body: { email: string; password: string; displayName?: string },
    ) {
        const data = await this.adminService.createUser(body);
        return { success: true, message: 'User created successfully', data };
    }

    @Patch('users/:id/activate')
    @ApiOperation({ summary: '[ADMIN] Activate a user account' })
    async activateUser(@Param('id', ParseUUIDPipe) id: string) {
        const data = await this.adminService.activateUser(id);
        return { success: true, message: 'User activated', data };
    }

    @Patch('users/:id/deactivate')
    @ApiOperation({ summary: '[ADMIN] Deactivate a user account' })
    async deactivateUser(@Param('id', ParseUUIDPipe) id: string) {
        const data = await this.adminService.deactivateUser(id);
        return { success: true, message: 'User deactivated', data };
    }

    @Post('users/:id/reset-password')
    @ApiOperation({
        summary: '[ADMIN] Reset a user password to system default',
        description: 'Returns the temporary password to share with the user.',
    })
    async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
        const data = await this.adminService.resetUserPassword(id);
        return {
            success: true,
            message: 'Password reset to default',
            data,
        };
    }

    @Delete('users/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '[ADMIN] Hard-delete a user and all their data' })
    async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
        const data = await this.adminService.deleteUser(id);
        return { success: true, message: 'User deleted', data };
    }
}
