import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BusinessVO } from 'src/libs/types';
import { isEmpty } from 'src/libs/helpers';
import { AdminService } from './admin.service';
import { BusinessService } from 'src/business/business.service';
import { parseNumberArray } from 'src/libs/helpers';
import { CommonService } from 'src/common/common.service';
//

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly businessService: BusinessService,
    private readonly commonService: CommonService,
  ) {}

  //비즈니스 리스트 조회
  @Get('business/list')
  async getBusinessAdminList(
    @Query('page') page?: string,
    @Query('type') type?: string,
    @Query('name') name?: string,
    @Query('status') status?: string,
    @Query('areaIds[]') areaIds?: string[] | string,
    @Query('order') order?: string,
  ) {
    const _areaIds = parseNumberArray(areaIds);
    return await this.adminService.getBusinessAdminList(
      type,
      name,
      status,
      page,
      _areaIds,
      order,
    );
  }

  //비즈니스 상세 조회
  @Get('business/detail')
  async getBusinessAdminDetail(@Query('id', ParseIntPipe) id: number) {
    const { status, message, data } =
      await this.businessService.getBusinessDetail(id);
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
      data: {
        item: data,
      },
    };
  }

  //비즈니스 아이템 등록
  @Post('business')
  async createBusinessAdmin(@Body() body: { business: BusinessVO }) {
    if (isEmpty(body)) {
      throw new BadRequestException('body.business is required.');
    }
    if (isEmpty(body.business.type)) {
      throw new BadRequestException('body.type is required.');
    }
    const { status, message } = await this.adminService.createBusinessAdmin(
      body.business,
    );

    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }

  //비즈니스 아이템 수정
  @Patch('business')
  async updateBusinessAdmin(@Body() body: { business?: BusinessVO } = {}) {
    if (isEmpty(body.business)) {
      throw new BadRequestException('body.business is required.');
    }
    if (isEmpty(body.business?.id)) {
      throw new BadRequestException('business.id is required.');
    }
    const { status, message } = await this.adminService.updateBusinessAdmin(
      body.business,
    );
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }

  //비즈니스 게시(노출)
  @Post('business/publish')
  async publishBusinessAdmin(@Query('id', ParseIntPipe) id: number) {
    if (isEmpty(id)) {
      throw new BadRequestException('query.id is required.');
    }
    const { status, message } =
      await this.adminService.publishBusinessAdmin(id);
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }

  //비즈니스 미게시(미노출)
  @Post('business/publish/back')
  async publishBusinessAdminBack(@Query('id', ParseIntPipe) id: number) {
    if (isEmpty(id)) {
      throw new BadRequestException('query.id is required.');
    }
    const { status, message } =
      await this.adminService.publishBusinessAdminBack(id);
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }

  //비즈니스 삭제
  @Delete('business')
  async deleteBusinessAdmin(@Query('id', ParseIntPipe) id: number) {
    if (isEmpty(id)) {
      throw new BadRequestException('query.id is required.');
    }
    const { status, message } = await this.adminService.deleteBusinessAdmin(id);
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }

  //비즈니스 랭킹 변경
  @Patch('business/rank')
  async setBusinessRankAdmin(
    @Query('id', ParseIntPipe) id: number,
    @Query('rank', ParseIntPipe) rank: number,
  ) {
    if (isEmpty(id)) {
      throw new BadRequestException('query.id is required.');
    }
    if (isEmpty(rank)) {
      throw new BadRequestException('query.rank is required.');
    }
    const { status, message } = await this.adminService.setBusinessRankAdmin(
      id,
      rank,
    );
    if (status !== HttpStatus.OK) {
      throw new HttpException(message, status);
    }
    return {
      status: HttpStatus.OK,
      message: message,
    };
  }
  @Delete('delete/test/log')
  async deleteTestLog(@Query('userId') userId: string) {
    return await this.commonService.deleteTestLog(userId);
  }
}
