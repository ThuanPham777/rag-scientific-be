import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupRequestDto } from './dto/signup-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { GoogleCodeAuthDto } from './dto/google-code-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { EmptyResponseDto } from '../common/dto/api-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getDeviceInfo(req: Request): string {
    return req.headers['user-agent'] ?? 'unknown';
  }

  private getIpAddress(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.socket.remoteAddress ??
      'unknown'
    );
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account with email and password',
  })
  @ApiBody({ type: SignupRequestDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: SignupResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async signUp(@Body() dto: SignupRequestDto): Promise<SignupResponseDto> {
    const data = await this.authService.signUp(dto);
    return SignupResponseDto.fromUser(data, 'User successfully registered');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(
      dto,
      this.getDeviceInfo(req),
      this.getIpAddress(req),
    );
    return LoginResponseDto.fromResult(result, 'User successfully logged in');
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google OAuth login',
    description: 'Authenticate user with Google ID token',
  })
  @ApiBody({ type: GoogleAuthDto })
  @ApiResponse({
    status: 200,
    description: 'Google login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.googleAuth(
      dto,
      this.getDeviceInfo(req),
      this.getIpAddress(req),
    );
    return LoginResponseDto.fromResult(result, 'Google login successful');
  }

  @Post('google/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google OAuth login with Authorization Code',
    description:
      'Authenticate user with Google Authorization Code flow (more secure)',
  })
  @ApiBody({ type: GoogleCodeAuthDto })
  @ApiResponse({
    status: 200,
    description: 'Google login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid authorization code' })
  async googleCodeAuth(
    @Body() dto: GoogleCodeAuthDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.googleCodeAuth(
      dto,
      this.getDeviceInfo(req),
      this.getIpAddress(req),
    );
    return LoginResponseDto.fromResult(result, 'Google login successful');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.refreshTokens(
      dto,
      this.getDeviceInfo(req),
      this.getIpAddress(req),
    );
    return LoginResponseDto.fromResult(result, 'Tokens refreshed successfully');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke the refresh token',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  async logout(@Body() dto: LogoutDto): Promise<LogoutResponseDto> {
    await this.authService.logout(dto.refreshToken);
    return EmptyResponseDto.success('Logged out successfully');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revoke all refresh tokens for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices',
    type: LogoutResponseDto,
  })
  async logoutAll(@CurrentUser() user: any): Promise<LogoutResponseDto> {
    await this.authService.logoutAll(user.sub);
    return EmptyResponseDto.success('Logged out from all devices');
  }
}
