import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, AuthProvider } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByProviderId(provider: AuthProvider, providerId: string) {
    return this.prisma.user.findUnique({
      where: {
        provider_providerId: { provider, providerId },
      },
    });
  }

  async createLocalUser(data: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          provider: 'LOCAL',
        },
      });
    } catch (e) {
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async createOAuthUser(data: {
    email: string;
    provider: AuthProvider;
    providerId: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          provider: data.provider,
          providerId: data.providerId,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
        },
      });
    } catch (e) {
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Account already exists');
      }
      throw e;
    }
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Store hashed password reset token and expiry
   */
  async setPasswordResetToken(
    userId: string,
    hashedToken: string,
    expiresAt: Date,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Find user by hashed reset token that hasn't expired
   */
  async findByResetToken(hashedToken: string) {
    return this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Update user password and clear reset token
   */
  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  /**
   * Clear password reset token (invalidate)
   */
  async clearPasswordResetToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }
}
