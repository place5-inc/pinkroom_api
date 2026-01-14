import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as path from 'path';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import { registerFont } from 'canvas';

async function bootstrap() {
  const path = require('path');
  const rootPath = process.cwd(); // /home/site/wwwroot

  // API 결과로 확인된 확실한 경로
  const fontDir = path.join(rootPath, 'dist/resources/fonts');
  const fonts = [
    { file: 'Pretendard-Light.ttf', family: 'PretendardLight' },
    { file: 'Pretendard-Regular.ttf', family: 'PretendardRegular' },
    { file: 'Pretendard-Medium.ttf', family: 'PretendardMedium' },
    { file: 'Pretendard-Bold.ttf', family: 'PretendardBold' },
  ];
  const fs = require('fs');
  for (const font of fonts) {
    const fontPath = path.join(fontDir, font.file);
    if (!fs.existsSync(fontPath)) {
      continue;
    }
    registerFont(fontPath, { family: font.family });
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024 * 50 }),
  );

  app
    .getHttpAdapter()
    .getInstance()
    .register(fastifyView, {
      engine: {
        ejs: require('ejs'),
      },
    })
    .register(fastifyStatic, {
      root: path.join(__dirname, '..', 'resources'),
      prefix: '/static/',
    });

  const port = Number(process.env.PORT) || 8080;

  await app.listen(port, '0.0.0.0');
}
bootstrap();
