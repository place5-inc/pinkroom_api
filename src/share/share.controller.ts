import {
  Controller,
  Get,
  Query,
  BadRequestException,
  HttpException,
  HttpStatus,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { ShareService } from './share.service';
import { UploadPhotoBody } from 'src/libs/types';
import { isNull } from 'src/libs/helpers';
@Controller('share')
export class ShareController {
  constructor(private shareService: ShareService) {}

  @Get('code/:code')
  async getPhotoWithCode(@Param('code') code: string) {
    return await this.shareService.getPhotoWithCode(code);
  }
  @Post('code/make')
  async makePhotoCode(
    @Query('userId') userId: string,
    @Query('photoId') photoId: number,
    @Query('codeType') codeType: string,
  ) {
    return await this.shareService.makePhotoCode(userId, photoId, codeType);
  }
  @Get('randomName')
  async getRandomName(@Query('photoId') photoId: number) {
    if (isNull(photoId)) {
      throw new BadRequestException('photoId is required.');
    }
    return await this.shareService.getRandomName(photoId);
  }
}
