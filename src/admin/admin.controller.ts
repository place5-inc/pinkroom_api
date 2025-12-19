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
  @Get('test')
  async test() {
    return await this.adminService.test();
  }
}
