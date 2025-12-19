import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from './guards';
import { Public, User } from 'src/common/decorators/customize';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import type { Request, Response } from 'express';
import type { IUser } from '../users/users.interface';
import { AuthGuard } from '@nestjs/passport';
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Login',
    description:
      'Login with email and password to receive an access token and user information and permissions.',
  })
  @ApiBody({ type: AuthEmailLoginDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Login successful. Return access token and user information and permissions.',
    type: AuthEmailLoginDto,
  })
  @Post('/login')
  handleLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = ip || req.ip || 'Unknown IP';
    return this.authService.login(
      req.user as any,
      response,
      userAgent,
      ipAddress,
    );
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({
    summary: 'Refresh access token (Public API)',
    description:
      'API to refresh access token using refresh token (stored in httpOnly cookie).',
  })
  @Get('/refresh')
  handleRefreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @User() user: IUser,
    @Ip() ip: string,
  ) {
    const refreshToken = request.cookies['refresh_token'];
    const userAgent = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = ip || request.ip || 'Unknown IP';
    return this.authService.refreshAccessToken(
      refreshToken,
      response,
      user,
      userAgent,
      ipAddress,
    );
  }

  @Public()
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Register a new user with email and password.',
  })
  @Post('/register')
  handleRegister(@Body() authRegisterDto: AuthRegisterDto) {
    return this.authService.register(authRegisterDto);
  }

  @Post('/logout')
  @ApiOperation({
    summary: 'Logout (Current Device)',
    description:
      'Logout from current device. Deletes current session and clears cookie.',
  })
  handleLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    return this.authService.logout(response, refreshToken);
  }
}
