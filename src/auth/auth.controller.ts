import {
  Controller,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { isEmpty } from 'src/libs/helpers';
import { AuthBody } from 'src/libs/types';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sendCode')
  async sendCode(@Body() body: AuthBody) {
    if (isEmpty(body.phone)) {
      throw new BadRequestException('phone is required.');
    }

    return await this.authService.sendCode(body.phone);
  }
  @Post('confirmCode')
  async confirmCode(@Body() body: AuthBody) {
    if (isEmpty(body.phone)) {
      throw new BadRequestException('phone is required.');
    }
    if (isEmpty(body.code)) {
      throw new BadRequestException('code is required.');
    }
    return await this.authService.confirmCode(
      body.phone,
      body.code,
      body.sampleType,
    );
  }
  @Post('verify')
  async verify(@Body() body: AuthBody) {
    if (isEmpty(body.token)) {
      throw new BadRequestException('toekn is required.');
    }
    return await this.authService.verify(body.token);
  }
}
