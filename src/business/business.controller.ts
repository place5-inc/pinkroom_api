import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { parseNumberArray } from 'src/libs/helpers';
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}
}
