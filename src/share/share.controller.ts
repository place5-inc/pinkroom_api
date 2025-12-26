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
@Controller('share')
export class ShareController {
  constructor(private shareService: ShareService) {}

  @Get(':code')
  async getPhotoWithCode(@Param('code') code: string) {
    return await this.shareService.getPhotoWithCode(code);
  }
}
