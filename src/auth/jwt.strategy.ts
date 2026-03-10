import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  provider?: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

export interface CurrentUserPayload {
  id: string;
  email: string;
  provider?: string;
  role?: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'changeme',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    // Map payload.sub to id for easier access in controllers
    return {
      id: payload.sub,
      email: payload.email,
      provider: payload.provider,
      role: payload.role,
    };
  }
}
