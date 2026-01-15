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
import { join } from 'path';

async function bootstrap() {
  const rootPath = process.cwd();
  const fontPathBold = join(
    rootPath,
    'dist/resources/fonts/Pretendard-Bold.ttf',
  );

  const fontPathRegular = join(
    rootPath,
    'dist/resources/fonts/Pretendard-Regular.ttf',
  );

  const fortPathMedium = join(
    rootPath,
    'dist/resources/fonts/Pretendard-Medium.ttf',
  );

  console.log('[ThumbnailService] 폰트 경로 확인:', fontPathBold);
  const fs = require('fs');

  if (
    fs.existsSync(fontPathBold) &&
    fs.existsSync(fontPathRegular) &&
    fs.existsSync(fortPathMedium)
  ) {
    // registerFont(fontPathBold, { family: 'PretendardBold' });
    // registerFont(fontPathRegular, { family: 'PretendardRegular' });
    registerFont(fontPathRegular, {
      family: 'Pretendard',
      weight: '400',
    });
    registerFont(fontPathBold, {
      family: 'Pretendard',
      weight: '700',
    });
    registerFont(fortPathMedium, {
      family: 'Pretendard',
      weight: '500',
    });
    console.log(
      '[ThumbnailService] Pretendard 폰트 등록 완료 (PretendardBold, PretendardRegular)',
    );
  } else {
    console.warn(
      '[ThumbnailService] Pretendard TTF 파일을 찾을 수 없습니다. 기본 폰트를 사용합니다.',
    );
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
