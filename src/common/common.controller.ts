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
import {
  AdminCommonCodeType,
  CodeBody,
  isValidAdminCommonCodeType,
} from 'src/libs/types';
import { isEmpty } from 'src/libs/helpers';
import { UserService } from 'src/user/user.service';
import { CommonService } from './common.service';

@Controller('common')
export class CommonController {
  constructor(private commonService: CommonService) {}

  @Get('code/:type')
  async getStateList(
    @Param('type') type: AdminCommonCodeType,
    @Query('subType') subType?: string,
    @Query('isAdmin', new ParseBoolPipe({ optional: true })) isAdmin?: boolean,
  ) {
    const admin = isAdmin ?? false;
    if (isEmpty(type)) {
      throw new BadRequestException('query.type is required.');
    }
    if (!isValidAdminCommonCodeType(type)) {
      throw new BadRequestException('query.type is invalid.');
    }
    if (type === 'area') {
      const { status, message, data } =
        await this.commonService.getBusinessAreaCode(type);
      if (status !== HttpStatus.OK) {
        throw new HttpException(message, status);
      }
      return {
        status: HttpStatus.OK,
        message: message,
        data: data,
      };
    } else if (type === 'subway') {
      const { status, message, data } =
        await this.commonService.getBusinessSubwayCode(type);
      if (status !== HttpStatus.OK) {
        throw new HttpException(message, status);
      }
      return {
        status: HttpStatus.OK,
        message: message,
        data: data,
      };
    } else if (type === 'serviceCategory') {
      const { status, message, data } =
        await this.commonService.getServiceCategory(subType, admin);
      if (status !== HttpStatus.OK) {
        throw new HttpException(message, status);
      }
      return {
        status: HttpStatus.OK,
        message: message,
        data: data,
      };
    } else {
      throw new BadRequestException('query.type is invalid.');
    }
  }

  @Post('code')
  @Patch('code')
  async addCode(@Body() body: CodeBody) {
    return await this.commonService.addCode(
      body.type,
      body.parentId,
      body.id,
      body.name,
      body.nameKo,
      body.description,
      body.businessType,
      body.image,
    );
  }
  @Delete('code')
  async deleteCode(
    @Query('type') type: AdminCommonCodeType,
    @Query('id') id: number,
  ) {
    return await this.commonService.deleteCode(type, id);
  }
  @Post('log')
  async addLog(
    @Query('userId') userId: string,
    @Query('description') description: string,
  ) {
    const { status, message } = await this.commonService.addLog(
      userId,
      description,
    );
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: 'success',
    };
  }
  @Get('log')
  async getLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('userId') userId?: string,
  ) {
    const { status, message, data } = await this.commonService.getLog(
      page,
      userId,
    );
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
      data: data,
    };
  }
  @Get('business')
  async getBusiness(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
  ) {
    const { status, message, data } =
      await this.commonService.getBusiness(page);
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
      data: data,
    };
  }

  @Get('korea')
  async deleteTestLog() {
    return await this.commonService.deleteKoreaLogs();
  }
}
