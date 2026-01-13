import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  NotFoundException,
  All,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { PhotoService } from '../photo/photo.service';
import { UploadPhotoBody, Image } from 'src/libs/types';
import { isEmpty } from 'src/libs/helpers';
import * as path from 'path';

@Controller('user')
export class UserController {
  constructor(private photoService: PhotoService) {}
  @Post('photo/upload')
  async uploadPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.uploadPhoto(
      body.userId,
      body.image,
      body.designId,
      body.paymentId,
      body.code,
      body.isLowVersion,
    );
  }
  @Post('photo/retry')
  async retryPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.retryUploadPhoto(body.userId, body.photoId);
  }
  @Post('photo/remaining')
  async remainingPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.remainingPhoto(
      body.userId,
      body.photoId,
      body.paymentId,
      body.isLowVersion,
    );
  }
  @Get()
  async getPhotoList(@Query('userId') userId: string) {
    if (isEmpty(userId)) {
      throw new BadRequestException('userId is required.');
    }
    return await this.photoService.getPhotoList(userId);
  }
  @Get('photo')
  async getResultPhotoList(@Query('photoId') photoId: number) {
    if (isEmpty(photoId)) {
      throw new BadRequestException('photoId is required.');
    }
    return await this.photoService.getResultPhotoList(photoId);
  }
  @Get('test')
  async test(@Query('photoId') photoId: number) {
    if (isEmpty(photoId)) {
      throw new BadRequestException('photoId is required.');
    }
    return await this.photoService.test(photoId);
  }
  // @Get()
  // async getUser(@Request() { user: token }) {
  //   const { status, message, data } = await this.userService.getUser(
  //     token.userId,
  //   );
  //   if (status === HttpStatus.OK) {
  //     return data;
  //   }
  //   throw new HttpException(message, status);
  // }
  @Get('check/font/paths')
  checkFontPaths() {
    const rootPath = process.cwd();
    const dirname = __dirname;

    // 우리가 확인하고 싶은 의심 경로들
    const pathsToCheck = [
      'dist/resources/fonts',
      'resources/fonts',
      'wwwroot/dist/resources/fonts', // Azure 기본 경로 의심 1
      'wwwroot/resources/fonts', // Azure 기본 경로 의심 2
    ];

    const results = {
      environment: {
        currentWorkingDirectory: rootPath, // 현재 프로세스가 실행 중인 위치
        dirname: dirname, // 이 파일이 위치한 폴더
      },
      fileSystemScan: [],
      // 루트 폴더에는 당장 뭐가 있는지 확인 (최상위 구조 파악용)
      rootDirectoryList: this.safeReadDir(rootPath),
    };
    const fs = require('fs');

    // 각 의심 경로를 순회하며 검사
    pathsToCheck.forEach((subPath) => {
      const fullPath = path.join(rootPath, subPath);
      const exists = fs.existsSync(fullPath);

      results.fileSystemScan.push({
        pathChecked: fullPath,
        exists: exists,
        // 폴더가 존재하면 그 안에 들어있는 파일 목록을 보여줌 (폰트 파일이 진짜 있는지)
        files: exists ? this.safeReadDir(fullPath) : 'PATH_NOT_FOUND',
      });
    });

    return results;
  }

  // 폴더 읽다가 에러나도 서버 죽지 않게 막아주는 헬퍼 함수
  private safeReadDir(dirPath: string) {
    try {
      const fs = require('fs');
      // 파일인지 폴더인지 구분해서 보여줌
      return fs.readdirSync(dirPath).map((file) => {
        const fullPath = path.join(dirPath, file);
        try {
          return fs.statSync(fullPath).isDirectory()
            ? `[DIR] ${file}`
            : `[FILE] ${file}`;
        } catch {
          return `[UNKNOWN] ${file}`;
        }
      });
    } catch (error) {
      return `Error reading dir: ${error.message}`;
    }
  }
}
