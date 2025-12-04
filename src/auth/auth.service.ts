import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupRequestDto } from './dto/signup-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SignupResponseDto } from './dto/signup-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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

  async signUp(dto: SignupRequestDto): Promise<SignupResponseDto> {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash: hash,
      displayName: dto.displayName,
    });

    const response = new SignupResponseDto();
    response.data = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    };
    response.success = true;
    response.message = 'User successfully registered';
    return response;
  }

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.buildTokens(user);

    const response = new LoginResponseDto();
    response.data = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    };
    response.accessToken = tokens.accessToken;
    response.refreshToken = tokens.refreshToken;
    response.success = true;
    response.message = 'User successfully logged in';
    return response;
  }
}
