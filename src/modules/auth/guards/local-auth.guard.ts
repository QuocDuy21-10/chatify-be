import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthEmailLoginDto } from '../dto/auth-email-login.dto';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    // validate dto trước khi chạy passport
    const dto = plainToClass(AuthEmailLoginDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const messages = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }));
      throw new UnauthorizedException({
        message: 'Validation failed',
        errors: messages,
      });
    }
    request.body = dto;
    return (await super.canActivate(context)) as boolean;
  }
}
