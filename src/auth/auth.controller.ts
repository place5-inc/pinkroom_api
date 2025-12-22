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
import { isEmpty } from 'src/libs/helpers';
import { AuthBody } from 'src/libs/types';
import { MessageService } from 'src/message/message.service';

@Controller('auth')
export class AuthController {
  constructor(private messageService: MessageService) {}

  @Post('sendCode')
  async getCertiCode(@Body() body: AuthBody) {
    if (isEmpty(body.phone)) {
      throw new BadRequestException('phone is required.');
    }
    return await this.messageService.requestVerifyCode(body.phone);
  }
  @Post('confirmCode')
  async confirmCode(@Body() body: AuthBody) {
    if (isEmpty(body.phone)) {
      throw new BadRequestException('phone is required.');
    }
    return await this.messageService.requestVerifyCode(body.phone);
  }
}
