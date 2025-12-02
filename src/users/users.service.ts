import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmail(email: string) {
        return this.prisma.appUser.findUnique({ where: { email } });
    }

    async findById(id: string) {
        const user = await this.prisma.appUser.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async createUser(data: { email: string; passwordHash: string; displayName?: string }) {
        try {
            return await this.prisma.appUser.create({
                data: {
                    email: data.email,
                    passwordHash: data.passwordHash,
                    displayName: data.displayName,
                    role: UserRole.USER,
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
