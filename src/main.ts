import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configSwagger } from './configs/api-docs.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configApp } from './configs/app.config';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // config service
  const configService = app.get(ConfigService);

  // config app (guards, interceptors, pipes, cors, cookie parser, global prefix)
  configApp(app);

  // config swagger
  configSwagger(app);

  await app.listen(configService.get<number>('PORT') ?? 3000);
  Logger.log(
    `Server is running on: http://localhost:${configService.get<number>('PORT') ?? 3000}/api/v1`,
  );
  Logger.log(
    'Swagger Docs: http://localhost:' +
      `${configService.get<number>('PORT') ?? 3000}/api/docs`,
  );
}
bootstrap();
