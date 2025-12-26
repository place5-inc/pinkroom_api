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
} from '@nestjs/common';
import { UserService } from './user.service';
import { PhotoService } from './photo.service';
import { UploadPhotoVo, Image } from 'src/libs/types';

@Controller('user')
export class UserController {
  constructor(private photoService: PhotoService) {}
  @Post('photo')
  async uploadPhoto(@Body() body: UploadPhotoVo) {
    return await this.photoService.uploadPhoto(
      body.userId,
      body.image,
      body.designId,
      body.paymentId,
      body.code,
    );
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
