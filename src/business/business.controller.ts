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

  @Get('test')
  async test(@Query('times[]') times?: string[]) {
    // times optional, HH:mm 문자열 배열로 변환 & 검증
    const validTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    const timeList = times
      ? Array.isArray(times)
        ? times
        : [times] // 여기서 1개일 때 배열로 감싸줌
      : [];
    return await this.businessService.test(timeList);
  }
  @Get('list') //한번 더 시도
  async getBusinessList(
    @Query('type') type: string,
    @Query('areaIds[]') areaIds?: string[] | string,
    @Query('categoryIds[]') categoryIds?: string[] | string,
    @Query('itemIds[]') itemIds?: string[] | string,
    @Query('time[]') time?: string[],
    @Query('day') day?: string,
    @Query('page') page?: string,
  ) {
    // type 필수 체크
    if (!type) {
      throw new BadRequestException('type은 필수입니다.');
    }

    const parsedCategoryIds = parseNumberArray(categoryIds);
    const parsedItemIds = parseNumberArray(itemIds);
    const parsedAreaIds = parseNumberArray(areaIds);

    // times optional, HH:mm 문자열 배열로 변환 & 검증
    const validTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    const timeList = time
      ? Array.isArray(time)
        ? time
        : [time] // 여기서 1개일 때 배열로 감싸줌
      : [];

    const parsedTimes = timeList.filter((t) => validTimeRegex.test(t));

    // day optional, Date로 변환
    const parsedDay = day ? new Date(day) : undefined;
    if (day && Number.isNaN(parsedDay!.getTime())) {
      throw new BadRequestException('day는 YYYY-MM-DD 형식이어야 합니다.');
    }
    return await this.businessService.getBusinessList(
      type,
      parsedAreaIds,
      parsedCategoryIds,
      parsedItemIds,
      parsedTimes,
      parsedDay,
      page,
    );
  }

  @Get('detail')
  async getBusinessDetail(@Query('id', ParseIntPipe) id: number) {
    return await this.businessService.getBusinessDetail(id);
  }
}
