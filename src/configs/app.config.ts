import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { TransformInterceptor } from 'src/core/transform.interceptor';
import { JwtAuthGuard } from 'src/modules/auth/guards';

export function configApp(app: NestExpressApplication) {
  const reflector = app.get(Reflector);

  // config jwt guard global
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // config transform interceptor global
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // config static
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // config cookie parser
  app.use(cookieParser());

  // config validation pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // config cors
  app.enableCors({
    origin: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });

  // config cookie parser
  app.use(cookieParser());

  // config global prefix
  app.setGlobalPrefix('api/v1');
}
