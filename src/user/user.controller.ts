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
}
