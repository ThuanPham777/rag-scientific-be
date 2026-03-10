import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * AdminBootstrapService
 *
 * Runs on application startup. Reads ADMIN_USER + ADMIN_PASSWORD from environment
 * and upserts the superadmin user in the database with role SUPERADMIN.
 *
 * This ensures the superadmin account always exists and stays in sync
 * with the .env configuration without manual DB operations.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
    private readonly logger = new Logger(AdminBootstrapService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    async onModuleInit() {
        const adminEmail = this.config.get<string>('ADMIN_USER');
        const adminPassword = this.config.get<string>('ADMIN_PASSWORD');

        if (!adminEmail || !adminPassword) {
            this.logger.warn(
                'ADMIN_USER or ADMIN_PASSWORD not set in .env — skipping superadmin bootstrap.',
            );
            return;
        }

        try {
            const passwordHash = await bcrypt.hash(adminPassword, 10);

            const existing = await this.prisma.user.findUnique({
                where: { email: adminEmail },
            });

            if (existing) {
                // Update role and password if user already exists
                await this.prisma.user.update({
                    where: { email: adminEmail },
                    data: {
                        role: 'SUPERADMIN',
                        passwordHash,
                        isActive: true,
                    },
                });
                this.logger.log(`Superadmin account synced: ${adminEmail}`);
            } else {
                // Create new superadmin
                await this.prisma.user.create({
                    data: {
                        email: adminEmail,
                        passwordHash,
                        displayName: 'System Admin',
                        provider: 'LOCAL',
                        role: 'SUPERADMIN',
                        isActive: true,
                    },
                });
                this.logger.log(`Superadmin account created: ${adminEmail}`);
            }
        } catch (error) {
            this.logger.error('Failed to bootstrap superadmin account:', error);
        }
    }
}
