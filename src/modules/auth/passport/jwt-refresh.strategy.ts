import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionsService } from 'src/modules/sessions/sessions.service';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { JwtRefreshPayload } from '../interfaces/jwt-payload.interface';
import { IUser } from 'src/modules/users/users.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private sessionsService: SessionsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const token = request?.cookies?.refresh_token;
          if (!token) {
            throw new UnauthorizedException(
              'Refresh token not found in cookies',
            );
          }
          return token;
        },
      ]),
      secretOrKey: configService.get<string>('JWT_REFRESH_TOKEN_SECRET') || '',
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }
  async validate(req: Request, payload: JwtRefreshPayload): Promise<IUser> {
    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const session = await this.sessionsService.findSessionByToken(refreshToken);

    if (!session) {
      throw new UnauthorizedException(
        'Session does not exist or has expired. Please log in again.',
      );
    }

    this.sessionsService.updateLastUsedAt(refreshToken).catch((err) => {
      console.error('Failed to update session lastUsedAt:', err);
    });

    const user = await this.userModel
      .findById(payload.sub)
      .select('-password -refreshToken')
      .lean()
      .exec();

    if (!user) {
      throw new UnauthorizedException('User does not exist. Token is invalid.');
    }

    if (user.isDeleted) {
      throw new UnauthorizedException(
        'Account has been deleted. Token is invalid.',
      );
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
    };
  }
}
