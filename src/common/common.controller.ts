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
}
