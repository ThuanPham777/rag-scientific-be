import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
import { LogoutRequestDto } from './dto/logout-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
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
    summary: 'Register a new user account',
    description:
      'Create a new user account with email and password for local authentication.',
  })
  @ApiBody({
    type: SignupRequestDto,
    description: 'User registration information',
  })
  @ApiResponse({
    status: 201,
    description: 'User account successfully created',
    type: SignupResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email address is already registered',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data (validation errors)',
  })
  async signUp(@Body() dto: SignupRequestDto): Promise<SignupResponseDto> {
    const data = await this.authService.signUp(dto);
    return SignupResponseDto.fromUser(data, 'User successfully registered');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login with email and password',
    description:
      'Authenticate user with local credentials (email and password).',
  })
  @ApiBody({
    type: LoginRequestDto,
    description: 'User login credentials',
  })
  @ApiResponse({
    status: 200,
    description:
      'User successfully authenticated. Returns user info, access token, and refresh token.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid email or password, or account registered with different provider (e.g., Google)',
  })
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
    summary: 'Google OAuth login with ID token',
    description:
      'Authenticate user using Google ID token from client-side Google Sign-In.',
  })
  @ApiBody({
    type: GoogleAuthDto,
    description: 'Google ID token from client-side authentication',
  })
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
    summary: 'Google OAuth login with Authorization Code (Recommended)',
    description:
      'Authenticate user using Google Authorization Code flow - more secure than ID token flow.',
  })
  @ApiBody({
    type: GoogleCodeAuthDto,
    description: 'Google authorization code and related parameters',
  })
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
    description: 'Obtain a new access token using a valid refresh token.',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Current valid refresh token',
  })
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
    summary: 'Logout from current device',
    description:
      'Logout user by revoking the refresh token for the current session.',
  })
  @ApiBody({
    type: LogoutRequestDto,
    description: 'Refresh token to revoke',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  async logout(@Body() dto: LogoutRequestDto): Promise<LogoutResponseDto> {
    await this.authService.logout(dto.refreshToken);
    return EmptyResponseDto.success('Logged out successfully');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Logout user from all devices by revoking ALL refresh tokens.',
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset email',
    description:
      'Send a password reset email to the specified email address. Always returns success to prevent email enumeration.',
  })
  @ApiBody({
    type: ForgotPasswordRequestDto,
    description: 'Email address to send reset link to',
  })
  @ApiResponse({
    status: 200,
    description:
      'If the email exists, a reset link has been sent. Always returns 200.',
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
  ): Promise<ForgotPasswordResponseDto> {
    await this.authService.forgotPassword(dto);
    return EmptyResponseDto.success(
      'If an account with that email exists, a password reset link has been sent.',
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Reset user password using a valid reset token received via email.',
  })
  @ApiBody({
    type: ResetPasswordRequestDto,
    description: 'Reset token and new password',
  })
  @ApiResponse({
    status: 200,
    description: 'Password has been reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<ResetPasswordResponseDto> {
    await this.authService.resetPassword(dto);
    return EmptyResponseDto.success(
      'Password has been reset successfully. Please log in with your new password.',
    );
  }
}
