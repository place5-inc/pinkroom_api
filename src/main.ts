import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as path from 'path';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024 * 50 }),
  );
  // 정적 파일 설정
  app
    .getHttpAdapter()
    .getInstance()
    .register(fastifyView, {
      engine: {
        ejs: require('ejs'),
      },
    })
    .register(fastifyStatic, {
      root: path.join(__dirname, '..', 'resources'), // 정적 파일 경로
      prefix: '/static/', // URL 접두사
    });
  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();
