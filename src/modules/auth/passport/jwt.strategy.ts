import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { IUser } from 'src/modules/users/users.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_TOKEN_SECRET') || '',
    });
  }

  async validate(payload: JwtAccessPayload): Promise<IUser> {
    // Validate payload structure
    if (!payload.sub || payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('-password')
      .lean()
      .exec();

    if (!user) {
      throw new UnauthorizedException('User not found. Invalid token.');
    }

    if (user.isDeleted) {
      throw new UnauthorizedException(
        'Account has been deleted. Invalid token.',
      );
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  }
}
