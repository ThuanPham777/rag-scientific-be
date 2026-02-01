import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  provider?: string;
  iat?: number;
  exp?: number;
}

export interface CurrentUserPayload {
  id: string;
  email: string;
  provider?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'changeme',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    // Map payload.sub to id for easier access in controllers
    return {
      id: payload.sub,
      email: payload.email,
      provider: payload.provider,
    };
  }
}
