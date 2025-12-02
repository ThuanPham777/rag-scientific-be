import { Body, Controller, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, LogoutResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new user', description: 'Create a new user account with email and password' })
    @ApiBody({ type: SignUpDto })
    @ApiResponse({
        status: 201,
        description: 'User successfully registered',
        type: AuthResponseDto,
    })
    @ApiResponse({
        status: 409,
        description: 'Email already in use',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    async signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
        return this.authService.signUp(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'User login', description: 'Authenticate user with email and password' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'User successfully logged in',
        type: AuthResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid credentials',
    })
    async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'User logout', description: 'Logout the currently authenticated user' })
    @ApiResponse({
        status: 200,
        description: 'User successfully logged out',
        type: LogoutResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or missing token',
    })
    async logout(@Req() req: Request): Promise<LogoutResponseDto> {
        const user = req.user as { sub: string };
        return this.authService.logout(user.sub);
    }
}
