import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private configService: ConfigService,
  ) {}

  async createSession(
    userId: string,
    refreshToken: string,
    userAgent: string,
    ipAddress: string,
  ): Promise<SessionDocument> {
    const refreshTokenTTL = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const expiresAt = new Date(
      Date.now() + ms((refreshTokenTTL || '7d') as any),
    );

    const newSession = await this.sessionModel.create({
      userId: userId as any,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt,
      isActive: true,
      lastUsedAt: new Date(),
    });

    return newSession;
  }

  async findSessionByToken(
    refreshToken: string,
  ): Promise<SessionDocument | null> {
    return this.sessionModel
      .findOne({
        refreshToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .populate('userId', 'name email')
      .exec();
  }

  async deleteSession(refreshToken: string): Promise<boolean> {
    const result = await this.sessionModel.deleteOne({ refreshToken });
    return result.deletedCount > 0;
  }

  async updateLastUsedAt(refreshToken: string): Promise<void> {
    await this.sessionModel.updateOne(
      { refreshToken },
      { $set: { lastUsedAt: new Date() } },
    );
  }
}
