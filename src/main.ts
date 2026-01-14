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
    //{ file: 'Pretendard-Light.ttf', name: 'PretendardLight', weight: '300' },
    {
      file: 'Pretendard-Regular.ttf',
      name: 'PretendardRegular',
      weight: '400',
    },
    //{ file: 'Pretendard-Medium.ttf', name: 'PretendardMedium', weight: '500' },
    { file: 'Pretendard-Bold.ttf', name: 'PretendardBold', weight: '700' },
  ];
  const fs = require('fs');
  for (const font of fonts) {
    const fontPath = path.join(fontDir, font.file);
    if (!fs.existsSync(fontPath)) {
      continue;
    }
    registerFont(fontPath, {
      family: 'Pretendard',
      weight: font.weight,
    });
    console.log(`[Main] ${font.name} font registered`);
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
