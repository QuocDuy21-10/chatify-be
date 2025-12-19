import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcrypt';
import { AuthRegisterDto } from '../auth/dto/auth-register.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async register(user: AuthRegisterDto) {
    const { name, email, password } = user;

    const isExistEmail = await this.userModel.findOne({
      email,
      isDeleted: false,
    });
    if (isExistEmail) {
      throw new BadRequestException(
        `Email already exists in the system. Please use another email.`,
      );
    }

    const hashedPassword = this.hashPassword(password);
    let newUser = await this.userModel.create({
      name,
      email,
      password: hashedPassword,
    });
    return newUser;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ email, isDeleted: false });
  }

  hashPassword(password: string) {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  }

  findOneByUserEmail(email: string) {
    return this.userModel.findOne({ email: email });
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    return await this.userModel.findByIdAndUpdate(
      userId,
      {
        isOnline,
        lastSeen: new Date(),
      },
      { new: true },
    );
  }

  async searchUsers(q: string, currentUserId: string) {
    if (!q || q.trim().length === 0) {
      return [];
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const users = await this.userModel
      .find({
        _id: { $ne: currentUserId },
        isDeleted: false,
        name: searchRegex,
      })
      .select('-password')
      .limit(20)
      .lean()
      .exec();

    return users;
  }
}
