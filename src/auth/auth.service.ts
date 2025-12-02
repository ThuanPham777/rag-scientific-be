import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    private issueAccessToken(payload: Record<string, any>) {
        const accessTtl = this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
        return this.jwt.sign(payload, {
            expiresIn: accessTtl as `${number}${'m' | 'h' | 'd'}` | number,
        });
    }

    private issueRefreshToken(payload: Record<string, any>) {
        const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
        return this.jwt.sign(payload, {
            expiresIn: refreshTtl as `${number}${'m' | 'h' | 'd'}` | number,
        });
    }

    private buildTokens(user: { id: string; email: string; role: string }) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.issueAccessToken(payload);
        const refreshToken = this.issueRefreshToken(payload);
        return { accessToken, refreshToken };
    }

    async signUp(dto: SignUpDto) {
        const hash = await bcrypt.hash(dto.password, 10);
        const user = await this.usersService.createUser({
            email: dto.email,
            passwordHash: hash,
            displayName: dto.displayName,
        });

        const tokens = this.buildTokens(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
            ...tokens,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordOk) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = this.buildTokens(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
            ...tokens,
        };
    }

    // Với JWT stateless, logout cơ bản = client xoá token.
    // Nếu bạn muốn revoke refresh token, ta sẽ thêm bảng/field sau.
    async logout(_userId: string) {
        // TODO: nếu có bảng lưu refresh token thì xoá ở đây.
        return { success: true };
    }
}
