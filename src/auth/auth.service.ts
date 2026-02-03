import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupRequestDto } from './dto/signup-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResultDto, UserDto } from './dto/login-response.dto';
import { SignupUserDto } from './dto/signup-response.dto';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'crypto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { GoogleCodeAuthDto } from './dto/google-code-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(
        googleClientId,
        googleClientSecret,
        // redirect_uri will be provided per request for flexibility
      );
    }
  }

  private issueAccessToken(payload: Record<string, any>) {
    const accessTtl = this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    return this.jwt.sign(payload, { expiresIn: accessTtl });
  }

  private issueRefreshToken(payload: Record<string, any>) {
    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
    return this.jwt.sign(payload, { expiresIn: refreshTtl });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    const days = parseInt(
      this.config.get<string>('JWT_REFRESH_DAYS') ?? '7',
      10,
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async buildTokens(
    user: { id: string; email: string; provider: string },
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
    };
    const accessToken = this.issueAccessToken(payload);
    const refreshToken = this.issueRefreshToken(payload);

    // Store hashed refresh token in DB
    const hashedToken = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        deviceInfo,
        ipAddress,
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });

    return { accessToken, refreshToken };
  }

  // ========================
  // LOCAL AUTH: Sign Up
  // ========================
  /**
   * Register a new user
   * @returns Raw user data
   */
  async signUp(dto: SignupRequestDto): Promise<SignupUserDto> {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createLocalUser({
      email: dto.email,
      passwordHash: hash,
      displayName: dto.displayName,
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      provider: user.provider,
    };
  }

  // ========================
  // LOCAL AUTH: Login
  // ========================
  /**
   * Authenticate user with email and password
   * @returns Raw login result with user and tokens
   */
  async login(
    dto: LoginRequestDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<LoginResultDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is LOCAL provider
    if (user.provider !== 'LOCAL') {
      throw new UnauthorizedException(
        `Please login with ${user.provider.toLowerCase()}`,
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.buildTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ========================
  // GOOGLE OAUTH
  // ========================
  /**
   * Authenticate user with Google ID token
   * @returns Raw login result with user and tokens
   */
  async googleAuth(
    dto: GoogleAuthDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<LoginResultDto> {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    // Verify the Google ID token
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists with this Google account
    let user = await this.usersService.findByProviderId('GOOGLE', googleId);

    if (!user) {
      // Check if email already used by LOCAL account
      const existingUser = await this.usersService.findByEmail(email);
      if (existingUser && existingUser.provider === 'LOCAL') {
        throw new BadRequestException(
          'Email already registered. Please login with password.',
        );
      }

      // Create new Google user
      user = await this.usersService.createOAuthUser({
        email,
        provider: 'GOOGLE',
        providerId: googleId,
        displayName: name,
        avatarUrl: picture,
      });
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.buildTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ========================
  // GOOGLE OAUTH - AUTHORIZATION CODE FLOW
  // More secure than ID token flow
  // ========================
  /**
   * Authenticate user with Google Authorization Code
   * @returns Raw login result with user and tokens
   */
  async googleCodeAuth(
    dto: GoogleCodeAuthDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<LoginResultDto> {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientSecret) {
      throw new BadRequestException(
        'Google OAuth client secret is not configured',
      );
    }

    try {
      // Exchange authorization code for tokens
      const { tokens: googleTokens } = await this.googleClient.getToken({
        code: dto.code,
        redirect_uri: dto.redirectUri,
        // PKCE support
        codeVerifier: dto.codeVerifier,
      });

      if (!googleTokens.id_token) {
        throw new UnauthorizedException('Failed to get ID token from Google');
      }

      // Verify the ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleTokens.id_token,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const { sub: googleId, email, name, picture } = payload;

      // Check if user exists with this Google account
      let user = await this.usersService.findByProviderId('GOOGLE', googleId);

      if (!user) {
        // Check if email already used by LOCAL account
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser && existingUser.provider === 'LOCAL') {
          throw new BadRequestException(
            'Email already registered with password. Please login with your password.',
          );
        }

        // Create new Google user
        user = await this.usersService.createOAuthUser({
          email,
          provider: 'GOOGLE',
          providerId: googleId,
          displayName: name,
          avatarUrl: picture,
        });
      }

      // Update last login
      await this.usersService.updateLastLogin(user.id);

      // Issue our own JWT tokens
      const tokens = await this.buildTokens(user, deviceInfo, ipAddress);

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          provider: user.provider,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.error('Google OAuth error:', error);
      throw new UnauthorizedException(
        'Failed to authenticate with Google. Please try again.',
      );
    }
  }

  // ========================
  // REFRESH TOKEN
  // ========================
  /**
   * Refresh access and refresh tokens
   * @returns Raw login result with new tokens
   */
  async refreshTokens(
    dto: RefreshTokenDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<LoginResultDto> {
    // Verify the refresh token JWT
    let decoded: any;
    try {
      decoded = this.jwt.verify(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check token in DB
    const hashedToken = this.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (storedToken.isRevoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Delete old token (rotation) - use deleteMany to avoid error if already deleted
    // This can happen when multiple refresh requests are sent simultaneously
    await this.prisma.refreshToken.deleteMany({
      where: { id: storedToken.id },
    });

    // Issue new tokens
    const user = storedToken.user;
    const tokens = await this.buildTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ========================
  // LOGOUT
  // ========================
  /**
   * Revoke a refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: { isRevoked: true },
    });
  }

  // ========================
  // LOGOUT ALL DEVICES
  // ========================
  /**
   * Revoke all refresh tokens for a user
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
