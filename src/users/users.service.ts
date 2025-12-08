import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.app_user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.app_user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }) {
    try {
      return await this.prisma.app_user.create({
        data: {
          email: data.email,
          password_hash: data.passwordHash,
          display_name: data.displayName,
          role: 'user',
        },
      });
    } catch (e) {
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }
}
