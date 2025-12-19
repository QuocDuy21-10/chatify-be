import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { IUser } from '../users/users.interface';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';
import ms from 'ms';
import { Response } from 'express';
import { SessionsService } from '../sessions/sessions.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRegisterDto } from './dto/auth-register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findOneByUserEmail(email);
    if (user) {
      const isValid = this.usersService.isValidPassword(
        password,
        user.password,
      );
      if (isValid) {
        return user;
      }
    }
    return null;
  }

  async login(
    user: IUser,
    response: Response,
    ipAddress: string,
    userAgent: string,
  ) {
    const { _id } = user;

    const accessPayload: JwtAccessPayload = {
      sub: _id,
      type: 'access',
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: _id,
      type: 'refresh',
    };

    // create tokens
    const access_token = this.createAccessToken(accessPayload);
    const refresh_token = this.createRefreshToken(refreshPayload);

    await this.sessionsService.createSession(
      _id,
      refresh_token,
      userAgent,
      ipAddress,
    );

    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: ms(
        (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
          '7d') as any,
      ) as unknown as number,
    });

    return {
      access_token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async register(registerUserDto: AuthRegisterDto) {
    // Check email exist
    const isExist = await this.usersService.findByEmail(registerUserDto.email);
    if (isExist) {
      throw new BadRequestException('Email already exists');
    }

    const newUser = await this.usersService.register(registerUserDto);

    return {
      _id: newUser?._id,
      createdAt: newUser?.createdAt,
    };
  }

  async refreshAccessToken(
    oldRefreshToken: string,
    response: Response,
    user: IUser,
    userAgent: string,
    ipAddress: string,
  ) {
    try {
      const deleted = await this.sessionsService.deleteSession(oldRefreshToken);

      if (!deleted) {
        throw new BadRequestException('Session not found or already used');
      }

      const accessPayload: JwtAccessPayload = {
        sub: user._id,
        type: 'access',
      };

      const refreshPayload: JwtRefreshPayload = {
        sub: user._id,
        type: 'refresh',
      };

      const newAccessToken = this.createAccessToken(accessPayload);
      const newRefreshToken = this.createRefreshToken(refreshPayload);

      await this.sessionsService.createSession(
        user._id,
        newRefreshToken,
        userAgent,
        ipAddress,
      );

      response.clearCookie('refresh_token');
      response.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: ms(
          (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
            '7d') as any,
        ) as unknown as number,
      });

      return {
        access_token: newAccessToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      response.clearCookie('refresh_token');
      throw new BadRequestException(
        `Refresh token is invalid. Please log in again. Error: ${error.message}`,
      );
    }
  }

  async logout(response: Response, refreshToken: string) {
    await this.sessionsService.deleteSession(refreshToken);
    response.clearCookie('refresh_token');
    return { message: 'Logout successfully' };
  }

  createAccessToken(payload: JwtAccessPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn:
        (ms(
          (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ||
            '7d') as any,
        ) as unknown as number) / 1000,
    });
  }

  createRefreshToken(payload: JwtRefreshPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn:
        (ms(
          (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
            '7d') as any,
        ) as unknown as number) / 1000,
    });
  }
}
