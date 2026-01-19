import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PhotoService } from '../photo/photo.service';
import { UploadPhotoBody, Image, UserActionBody } from 'src/libs/types';
import { isEmpty } from 'src/libs/helpers';
import * as path from 'path';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(
    private photoService: PhotoService,
    private userService: UserService,
  ) {}
  @Post('photo/upload')
  async uploadPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.uploadPhoto(
      body.userId,
      body.image,
      body.designId,
      body.paymentId,
      body.code,
      body.isDummy,
      body.forceFail,
      body.delaySecond,
    );
  }
  @Post('photo/retry')
  async retryPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.retryUploadPhoto(
      body.userId,
      body.paymentId,
      body.retryCount,
      body.isDummy,
      body.forceFail,
      body.delaySecond,
    );
  }
  @Post('photo/remaining')
  async remainingPhoto(@Body() body: UploadPhotoBody) {
    return await this.photoService.remainingPhoto(
      body.userId,
      body.photoId,
      body.paymentId,
      body.isDummy,
      body.forceFail,
      body.delaySecond,
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
  @Post('actionLog')
  async addUserActionLog(@Body() body: UserActionBody) {
    return await this.userService.addUserActionLog(body);
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
  @Get('font/test')
  async fontTest(@Query('photoId') photoId: number) {
    if (isEmpty(photoId)) {
      throw new BadRequestException('photoId is required.');
    }
    return await this.photoService.fontTest(photoId);
  }
  @Patch('photo/completePopupShown')
  async markCompletePopupShown(@Body() body: { photoId: number }) {
    if (isEmpty(body.photoId)) {
      throw new BadRequestException('photoId is required.');
    }
    return await this.photoService.markCompletePopupShown(body.photoId);
  }
}
