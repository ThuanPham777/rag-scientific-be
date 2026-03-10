import {
    Controller,
    Get,
    Patch,
    Body,
    UseGuards,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // =============================
    // GET /users/me
    // =============================
    @Get('me')
    @ApiOperation({ summary: 'Get current user profile and dashboard stats' })
    @ApiResponse({ status: 200, description: 'User profile with stats' })
    async getMe(@CurrentUser() jwtUser: any) {
        const user = await this.usersService.findById(jwtUser.id);

        // Run stats independently – falls back to zeroes if DB schema is drifted
        let stats: any = {
            papersUploaded: 0,
            conversations: 0,
            collaborativeSessions: 0,
            memberSince: null,
        };
        try {
            stats = await this.usersService.getProfileStats(jwtUser.id);
        } catch (e) {
            console.error('[getMe] getProfileStats failed:', (e as Error).message);
        }

        return {
            success: true,
            data: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                provider: user.provider,
                createdAt: user.createdAt,
                stats,
            },
        };
    }

    // =============================
    // PATCH /users/me
    // =============================
    @Patch('me')
    @ApiOperation({ summary: 'Update current user display name or avatar URL' })
    @ApiResponse({ status: 200, description: 'Profile updated' })
    async updateProfile(
        @CurrentUser() jwtUser: any,
        @Body() dto: UpdateProfileDto,
    ) {
        const updated = await this.usersService.updateProfile(jwtUser.id, dto);

        return {
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: updated.id,
                email: updated.email,
                displayName: updated.displayName,
                avatarUrl: updated.avatarUrl,
                provider: updated.provider,
            },
        };
    }

    // =============================
    // PATCH /users/me/password
    // =============================
    @Patch('me/password')
    @ApiOperation({
        summary: 'Change password (LOCAL accounts only)',
        description:
            'Requires old password verification. Google OAuth users cannot use this endpoint.',
    })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({
        status: 401,
        description: 'Old password is incorrect or user is OAuth',
    })
    async changePassword(
        @CurrentUser() jwtUser: any,
        @Body() dto: ChangePasswordDto,
    ) {
        const user = await this.usersService.findById(jwtUser.id);

        // Only LOCAL users can change password
        if (user.provider !== 'LOCAL') {
            throw new BadRequestException(
                'Password change is not available for Google accounts.',
            );
        }

        if (!user.passwordHash) {
            throw new BadRequestException('No password is set for this account.');
        }

        const oldPasswordOk = await bcrypt.compare(dto.oldPassword, user.passwordHash);
        if (!oldPasswordOk) {
            throw new UnauthorizedException('Current password is incorrect.');
        }

        if (dto.oldPassword === dto.newPassword) {
            throw new BadRequestException(
                'New password must be different from the current password.',
            );
        }

        const newHash = await bcrypt.hash(dto.newPassword, 10);
        await this.usersService.updatePassword(user.id, newHash);

        return {
            success: true,
            message: 'Password changed successfully.',
        };
    }
}
