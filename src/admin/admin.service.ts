import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const DEFAULT_RESET_PASSWORD = 'Reset@123456';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    // ============================================================
    // SYSTEM DASHBOARD STATS
    // ============================================================

    /**
     * Get system-wide statistics for the admin dashboard.
     * No new tables needed — computed from existing tables.
     */
    async getSystemStats(rangeDays: number = 7) {
        const since = new Date();
        since.setDate(since.getDate() - rangeDays);

        const [
            totalUsers,
            activeUsers,
            totalPapers,
            totalConversations,
            conversationsInRange,
            newUsersInRange,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { isActive: true } }),
            this.prisma.paper.count(),
            this.prisma.conversation.count(),
            this.prisma.conversation.count({
                where: { createdAt: { gte: since } },
            }),
            this.prisma.user.count({
                where: { createdAt: { gte: since } },
            }),
        ]);

        return {
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
            totalPapers,
            totalConversations,
            conversationsInRange,
            newUsersInRange,
            rangeDays,
            since: since.toISOString(),
        };
    }

    /**
     * Get recent user registrations for the dashboard table.
     */
    async getRecentUsers(limit: number = 10) {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                provider: true,
                role: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true,
                _count: {
                    select: { papers: true, conversations: true },
                },
            },
        });
    }

    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    /**
     * Get paginated list of all users with optional search and filters.
     */
    async getUsers(params: {
        page?: number;
        limit?: number;
        search?: string;
        isActive?: boolean;
    }) {
        const { page = 1, limit = 20, search, isActive } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    avatarUrl: true,
                    provider: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    lastLoginAt: true,
                    _count: {
                        select: {
                            papers: true,
                            conversations: true,
                            sessionMembers: true,
                        },
                    },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        };
    }

    /**
     * Get a single user's detailed profile with stats.
     */
    async getUserDetail(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                provider: true,
                role: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        papers: true,
                        conversations: true,
                        sessionMembers: true,
                        notebooks: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        // Shared sessions = collaborative conversations this user is a member of
        const sharedSessions = await this.prisma.sessionMember.count({
            where: { userId, conversation: { isCollaborative: true } },
        });

        return { ...user, sharedSessions };
    }

    /**
     * Get paginated list of papers uploaded by a specific user.
     */
    async getUserPapers(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [papers, total] = await Promise.all([
            this.prisma.paper.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    fileName: true,
                    title: true,
                    status: true,
                    fileSize: true,
                    numPages: true,
                    createdAt: true,
                    processedAt: true,
                },
            }),
            this.prisma.paper.count({ where: { userId } }),
        ]);

        return {
            papers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Activate a user account.
     */
    async activateUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User ${userId} not found`);

        return this.prisma.user.update({
            where: { id: userId },
            data: { isActive: true },
            select: { id: true, email: true, isActive: true },
        });
    }

    /**
     * Deactivate a user account. Also revokes all refresh tokens.
     */
    async deactivateUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User ${userId} not found`);

        if (user.role === 'SUPERADMIN') {
            throw new ConflictException('Cannot deactivate a superadmin account.');
        }

        await this.prisma.refreshToken.updateMany({
            where: { userId },
            data: { isRevoked: true },
        });

        return this.prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
            select: { id: true, email: true, isActive: true },
        });
    }

    /**
     * Create a new regular user.
     */
    async createUser(data: {
        email: string;
        password: string;
        displayName?: string;
    }) {
        const existing = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existing) {
            throw new ConflictException('Email already in use');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        return this.prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                displayName: data.displayName,
                provider: 'LOCAL',
                role: 'USER',
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                provider: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
    }

    /**
     * Hard-delete a user and all related data (cascades via Prisma).
     */
    async deleteUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User ${userId} not found`);

        if (user.role === 'SUPERADMIN') {
            throw new ConflictException('Cannot delete the superadmin account.');
        }

        await this.prisma.user.delete({ where: { id: userId } });
        return { deleted: true, userId };
    }

    /**
     * Reset a user's password to the system default.
     * Returns the new temporary password in plaintext (admin should share with user).
     */
    async resetUserPassword(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User ${userId} not found`);

        if (user.provider !== 'LOCAL') {
            throw new ConflictException(
                'Cannot reset password for OAuth accounts (Google).',
            );
        }

        const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpiresAt: null,
            },
        });

        // Revoke all refresh tokens to force re-login
        await this.prisma.refreshToken.updateMany({
            where: { userId },
            data: { isRevoked: true },
        });

        return { userId, temporaryPassword: DEFAULT_RESET_PASSWORD };
    }
}
