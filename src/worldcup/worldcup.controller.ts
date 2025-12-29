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
import { WorldcupService } from './worldcup.service';
import { WorldcupBody } from 'src/libs/types';
import { isEmpty } from 'src/libs/helpers';
@Controller('worldcup')
export class WorldcupController {
  constructor(private worldcupService: WorldcupService) {}

  @Get('list')
  async getWorldcupList(@Query('userId') userId: string) {
    return await this.worldcupService.getWorldcupList(userId);
  }
  @Get('detail')
  async getWorldcupReusults(
    @Query('userId') userId: string,
    @Query('photoId') photoId: number,
  ) {
    return await this.worldcupService.getWorldcupReusults(userId, photoId);
  }
  @Post('vote')
  async vote(@Body() body: WorldcupBody) {
    if (isEmpty(body.code)) {
      throw new BadRequestException('code is required.');
    }
    if (isEmpty(body.resultId)) {
      throw new BadRequestException('resultId is required.');
    }
    if (isEmpty(body.name)) {
      if (isEmpty(body.userId)) {
        throw new BadRequestException('name or userId is need.');
      }
    }
    return await this.worldcupService.vote(
      body.code,
      body.resultId,
      body.name,
      body.userId,
    );
  }
}
