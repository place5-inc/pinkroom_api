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
