import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { BusinessType, BusinessVO, DTO, Image } from 'src/libs/types';
import { sql } from 'kysely';
import { BusinessHelper, BusinessSubwayJoined } from './business.helper';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class BusinessService {
  constructor(private readonly db: DatabaseProvider) {}

  async test(times?: string[]) {
    await this.db
      .insertInto('business_schedule_hours')
      .values({
        business_id: 0,
        weekday: 0,
        open_time: times[0],
        close_time: times[1],
        is_open: true,
      })
      .execute();
  }
  async getBusinessList(
    type: string,
    areaIds?: number[],
    categoryIds?: number[],
    itemIds?: number[],
    times?: string[],
    day?: Date,
    page?: string,
  ) {
    const pageSize = 50;
    try {
      let query = this.db
        .selectFrom('business')
        .where('status', '=', 'publish')
        .where('type', '=', type);
      // categoryIds OR itemIds 조건
      if (
        (categoryIds && categoryIds.length > 0) ||
        (itemIds && itemIds.length > 0)
      ) {
        query = query.where((eb) =>
          eb.or([
            ...(categoryIds && categoryIds.length > 0
              ? [
                  eb(
                    'id',
                    'in',
                    this.db
                      .selectFrom('business_service_category')
                      .select('business_id')
                      .where('code_id', 'in', categoryIds),
                  ),
                ]
              : []),
            ...(itemIds && itemIds.length > 0
              ? [
                  eb(
                    'id',
                    'in',
                    this.db
                      .selectFrom('business_service_item')
                      .select('business_id')
                      .where('code_id', 'in', itemIds),
                  ),
                ]
              : []),
          ]),
        );
      }

      if (day) {
        const jsWeekday = day.getDay();
        const dbWeekday = jsWeekday; // === 0 ? 7 : jsWeekday;
        const nthWeek = Math.floor((day.getDate() - 1) / 7) + 1;

        if (times && times.length > 0) {
          query = query.where((eb) =>
            eb.or(
              times.map((time) =>
                eb.and([
                  // 기본 스케줄: booking_deadline 있으면 그것, 없으면 close_time 비교
                  eb('id', 'in', (sub) =>
                    sub
                      .selectFrom('business_schedule_hours')
                      .select('business_id')
                      .where('weekday', '=', dbWeekday)
                      .where('is_open', '=', true)
                      .where(sql<boolean>`open_time <= ${time}`)
                      .where(
                        sql<boolean>`COALESCE(booking_deadline, close_time) >= ${time}`,
                      ),
                  ),
                  // 예외 recurring 제외
                  eb('id', 'not in', (exSub) =>
                    exSub
                      .selectFrom('business_schedule_exception_recurring')
                      .select('business_id')
                      .where('weekday', '=', dbWeekday)
                      .where('nth_week', '=', nthWeek)
                      .where('is_open', '=', false),
                  ),
                  // 점심시간 / breaks 제외
                  eb('id', 'not in', (breakSub) =>
                    breakSub
                      .selectFrom('business_schedule_breaks')
                      .select('business_id')
                      .where('weekday', '=', dbWeekday)
                      .where('is_open', '=', false)
                      .where(sql<boolean>`open_time <= ${time}`)
                      .where(sql<boolean>`close_time >= ${time}`),
                  ),
                ]),
              ),
            ),
          );
        } else {
          // times 없는 경우: weekday만 체크
          query = query
            .where('id', 'in', (sub) =>
              sub
                .selectFrom('business_schedule_hours')
                .select('business_id')
                .where('is_open', '=', true)
                .where('weekday', '=', dbWeekday),
            )
            .where('id', 'not in', (exSub) =>
              exSub
                .selectFrom('business_schedule_exception_recurring')
                .select('business_id')
                .where('weekday', '=', dbWeekday)
                .where('nth_week', '=', nthWeek)
                .where('is_open', '=', false),
            );
        }
      }
      if (areaIds && areaIds.length > 0) {
        query = query.where('area_id', 'in', areaIds);
      }
      let numPage = 1;
      if (page) {
        numPage = parseInt(page);
      }
      let offset = (numPage - 1) * pageSize;
      if (!page) {
        offset = 0;
      }
      let data = await query
        .selectAll()
        .orderBy('rank', 'desc') //랭킹 점수가 큰 값(ex. 9999)이 먼저 나오도록
        .orderBy('id', 'asc') //랭킹 점수가 만약 같다면, id가 작은 값(=먼저 등록된)의 업체가 먼저 나오도록
        .offset(offset)
        .fetch(pageSize)
        .execute();
      if (data.length === 0) {
        return {
          status: HttpStatus.OK,
          message: '',
          data: [],
        };
      }

      const businessIds = data.map((x) => x.id);
      const images = (
        await this.db
          .selectFrom('business_images')
          .where('business_id', 'in', businessIds)
          .selectAll()
          .execute()
      ).map((el) => ({
        businessId: el.business_id,
        url: el.url,
      }));
      const subway = (
        await this.db
          .selectFrom('business_subway')
          .where('business_id', 'in', businessIds)
          .selectAll()
          .orderBy('subway_id')
          .execute()
      ).map((el) => ({
        businessId: el.business_id,
        subwayId: el.subway_id,
      }));
      const serviceCategory = (
        await this.db
          .selectFrom('business_service_category as bsc')
          .leftJoin(
            'code_business_service_category as code',
            'code.id',
            'bsc.code_id',
          )
          .where('business_id', 'in', businessIds)
          .select(['bsc.business_id', 'bsc.code_id', 'code.name'])
          .orderBy('code.id')
          .execute()
      ).map((el) => ({
        businessId: el.business_id,
        code_id: el.code_id,
        name: el.name,
      }));
      // images를 businessId 기준으로 묶기
      const imagesByBusinessId = images.reduce(
        (acc, el) => {
          if (!acc[el.businessId]) acc[el.businessId] = [];
          acc[el.businessId].push({ url: el.url });
          return acc;
        },
        {} as Record<number, { url: string }[]>,
      );

      // subway를 businessId 기준으로 묶기
      const subwayByBusinessId = subway.reduce(
        (acc, el) => {
          if (!acc[el.businessId]) acc[el.businessId] = [];
          acc[el.businessId].push(String(el.subwayId)); // ★ string으로 변환!
          return acc;
        },
        {} as Record<number, string[]>,
      );

      // serviceCategory를 businessId 기준으로 묶기
      const serviceCategoryByBusinessId = serviceCategory.reduce(
        (acc, el) => {
          if (!acc[el.businessId]) acc[el.businessId] = [];
          acc[el.businessId].push({
            codeId: el.code_id,
            name: el.name,
          });
          return acc;
        },
        {} as Record<number, { codeId: number; name: string }[]>,
      );

      const list: BusinessVO[] = data.map((b, i) => ({
        id: b.id,
        type: b.type as BusinessType,
        name: b.name,
        nameKo: b.name_ko,
        rank: b.rank,
        accessInfo: b.access_info,
        curationPrice: b.curation_price,
        curationService: b.curation_service,
        curationTraffic: b.curation_traffic,
        lineUrl: b.line_url,
        areaId: b.area_id,
        x: b.x,
        y: b.y,
        images: imagesByBusinessId[b.id] ?? [],
        subway: subwayByBusinessId[b.id] ?? [],
        serviceCategory: serviceCategoryByBusinessId[b.id] ?? [],
        marker: i + 1 + (numPage - 1) * pageSize,
      }));
      return {
        status: HttpStatus.OK,
        message: '',
        data: {
          list,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async getBusinessDetail(id: number): DTO<BusinessVO> {
    let business: BusinessVO | null = null;
    try {
      const businessRowsPromise = this.db
        .selectFrom('business as b')
        .leftJoin('business_subway as bs', 'b.id', 'bs.business_id')
        .leftJoin('code_business_area as cba', 'b.area_id', 'cba.id')
        .select([
          'b.id',
          'b.type',
          'b.area_id',
          'b.name',
          'b.name_ko',
          'b.curation_price',
          'b.curation_traffic',
          'b.curation_service',
          'b.rank',
          'b.line_url',
          'b.access_info',
          'b.status',
          'b.x',
          'b.y',
          'bs.subway_id',
          'cba.name as area_name',
          'cba.name_ko as area_name_ko',
        ])
        .where('b.id', '=', id)
        .execute();

      // DB 쿼리 2: 이미지
      const imagesPromise = this.db
        .selectFrom('business_images')
        .where('business_id', '=', id)
        .orderBy('order_seq', 'asc')
        .selectAll()
        .execute();

      // DB 쿼리 3: 상세 정보
      const detailPromise = this.db
        .selectFrom('business_detail')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();

      // DB 쿼리 4: 서비스 카테고리 및 아이템 (한 번의 쿼리로 조인해서 가져오는 것이 효율적)
      const serviceItemsPromise = this.db
        .selectFrom('business_service_category as bsc')
        .innerJoin(
          'code_business_service_category as cbsc',
          'bsc.code_id',
          'cbsc.id',
        )
        .leftJoin('business_service_item as bsi', (join) =>
          join
            .onRef('bsc.business_id', '=', 'bsi.business_id')
            .onRef('bsc.code_id', '=', 'bsi.category_id'),
        ) // Category -> Item 연결
        .leftJoin(
          'code_business_service_item as cbsi',
          'bsi.code_id',
          'cbsi.id',
        )
        .leftJoin('upload_file as uf', 'cbsi.upload_file_id', 'uf.id')
        .where('bsc.business_id', '=', id)
        .select([
          // Category info
          'bsc.id as category_id',
          'bsc.code_id as category_code_id',
          'cbsc.name as category_name',
          'cbsc.name_ko as category_name_ko',
          // Item info
          'bsi.code_id as item_code_id',
          'cbsi.name as item_name',
          'cbsi.name_ko as item_name_ko',
          'cbsi.description as item_description',
          'cbsi.url as item_url',
          'uf.url as item_file_url',
        ])
        .orderBy('cbsc.order_seq', 'asc')
        .orderBy('bsi.code_id', 'asc')
        .execute();

      // DB 쿼리 5: section
      const sectionPromise = this.db
        .selectFrom('business_section')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      // DB 쿼리 6: member
      const memberPromise = this.db
        .selectFrom('business_member as bm')
        .leftJoin('upload_file as uf', 'bm.upload_file_id', 'uf.id') // 이미지 테이블 조인
        .where('bm.business_id', '=', id)
        .select([
          'bm.name',
          'bm.grade',
          'bm.job',
          'uf.id as profile_image_id',
          'uf.url as profile_image_url',
        ])
        .execute();

      // DB 쿼리 7: review
      const reviewPromise = this.db
        .selectFrom('business_review')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      // 2. 병렬 실행 (Parallel Execution)
      const [
        rows,
        images,
        detailRow,
        serviceRows,
        sectionRows,
        memberRows,
        reviewRows,
      ] = await Promise.all([
        businessRowsPromise,
        imagesPromise,
        detailPromise,
        serviceItemsPromise,
        sectionPromise,
        memberPromise,
        reviewPromise,
      ]);

      // 3. 비즈니스 존재 여부 체크 (Early Return)
      if (rows.length === 0) {
        // *중요: try-catch 없이 던지거나, 컨트롤러 레벨에서 처리하도록 허용해야 404가 나갑니다.
        throw new NotFoundException('Business not found');
      }

      if (!detailRow) {
        throw new NotFoundException('Business detail not found');
      }
      const base = rows[0];

      // Subway ID 중복 제거
      const subwayIds = [
        ...new Set(rows.map((r) => r.subway_id).filter((id) => id !== null)),
      ];

      const _business: BusinessSubwayJoined = {
        ...base,
        updated_at: new Date(),
        subway_id: subwayIds,
        area_name_ko: base.area_name_ko ?? null,
        area_name: base.area_name ?? null,
      };

      business = BusinessHelper.toBusinessForAdmin(_business);

      // 이미지 매핑
      if (images.length > 0) {
        business.images = images.map(BusinessHelper.toBusinessImages);
      }

      // 상세정보 매핑
      let reviewOnGoogle: string | null = null;
      let reviewOnNaver: string | null = null;
      business.detail = BusinessHelper.toBusinessDetail(detailRow);
      if (detailRow.review_google_url) {
        reviewOnGoogle = detailRow.review_google_url;
      }
      if (detailRow.review_naver_url) {
        reviewOnNaver = detailRow.review_naver_url;
      }

      // 서비스 카테고리 & 아이템 그룹핑 (Application-side Grouping)
      if (serviceRows.length > 0) {
        const categoryMap = new Map<number, any>(); // 타입 정의 필요시 인터페이스 생성

        for (const row of serviceRows) {
          if (!categoryMap.has(row.category_id)) {
            categoryMap.set(row.category_id, {
              id: row.category_code_id,
              name: row.category_name,
              nameKo: row.category_name_ko,
              items: [],
            });
          }

          // 아이템이 있는 경우에만 추가 (Left Join이므로 null일 수 있음)
          if (row.item_code_id) {
            const itemVo = BusinessHelper.toBusinessServiceItem({
              item_id: row.item_code_id,
              category_id: row.category_id,
              item_name: row.item_name,
              item_name_ko: row.item_name_ko,
              item_description: row.item_description,
              item_url: row.item_url,
              item_upload_file_url: row.item_file_url,
              // 필요한 필드 매핑
            });
            categoryMap.get(row.category_id).items.push(itemVo);
          }
        }
        business.serviceCategory = Array.from(categoryMap.values());
      }
      if (sectionRows.length > 0) {
        business.detail.sections =
          BusinessHelper.toBusinessSection(sectionRows);
      }

      if (memberRows.length > 0) {
        business.detail.members = memberRows.map(
          BusinessHelper.toBusinessMember,
        );
      }

      if (reviewRows.length > 0) {
        business.detail.reviews = BusinessHelper.toBusinessReview(reviewRows);
        if (reviewOnGoogle) {
          const review = business.detail.reviews.find(
            (review) => review.type === 'google',
          );
          if (review) {
            review.linkUrl = reviewOnGoogle;
          }
        }
        if (reviewOnNaver) {
          const review = business.detail.reviews.find(
            (review) => review.type === 'naver',
          );
          if (review) {
            review.linkUrl = reviewOnNaver;
          }
        }
      }

      // 1. 해당 비즈니스의 모든 카테고리 조회 (부모, 자식 상관없이 전부)
      const categoriesPromise = this.db
        .selectFrom('business_price_category')
        .where('business_id', '=', id)
        .orderBy('order_seq', 'asc') // 정렬 미리 수행
        .selectAll()
        .execute();

      // 2. 해당 비즈니스의 모든 아이템 조회
      // (Items 테이블에는 business_id가 없으므로 Category를 Join해서 가져옴)
      const itemsPromise = this.db
        .selectFrom('business_price_item as bpi')
        .innerJoin(
          'business_price_category as bpc',
          'bpi.category_id',
          'bpc.id',
        )
        .where('bpc.business_id', '=', id)
        .select([
          'bpi.id',
          'bpi.category_id',
          'bpi.name',
          'bpi.price',
          'bpi.min_price',
          'bpi.max_price',
          'bpi.order_seq',
        ])
        .orderBy('bpi.order_seq', 'asc') // 정렬 미리 수행
        .execute();

      // 병렬 실행
      const [categories, items] = await Promise.all([
        categoriesPromise,
        itemsPromise,
      ]);

      // Helper를 통해 트리 구조로 조립
      if (categories.length > 0) {
        business.detail.price = BusinessHelper.toBusinessPriceTree(
          categories,
          items,
        );
      } else {
        business.detail.price = [];
      }

      //병렬실행
      const scheduleHoursPromise = this.db
        .selectFrom('business_schedule_hours')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      const scheduleExceptionRecurringPromise = this.db
        .selectFrom('business_schedule_exception_recurring')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      const scheduleBreaksPromise = this.db
        .selectFrom('business_schedule_breaks')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      const scheduleMentsPromise = this.db
        .selectFrom('business_schedule_ments')
        .where('business_id', '=', id)
        .selectAll()
        .execute();

      const [
        scheduleHoursRows,
        scheduleExceptionRecurringRows,
        scheduleBreaksRows,
        scheduleMentsRows,
      ] = await Promise.all([
        scheduleHoursPromise,
        scheduleExceptionRecurringPromise,
        scheduleBreaksPromise,
        scheduleMentsPromise,
      ]);

      business.detail.schedule = {
        scheduleHours: [],
        scheduleException: [],
        scheduleBreaks: [],
        scheduleMent: [],
      };

      if (scheduleHoursRows.length > 0) {
        const raw = scheduleHoursRows.map((r) =>
          BusinessHelper.toBusinessScheduleHours(r),
        );
        const merged = BusinessHelper.mergeScheduleHours(raw);
        business.detail.schedule.scheduleHours = merged;
      }
      if (scheduleExceptionRecurringRows.length > 0) {
        business.detail.schedule.scheduleException =
          scheduleExceptionRecurringRows.map(
            BusinessHelper.toBusinessScheduleExceptionRecurring,
          );
      }
      if (scheduleBreaksRows.length > 0) {
        business.detail.schedule.scheduleBreaks = scheduleBreaksRows.map(
          BusinessHelper.toBusinessScheduleBreaks,
        );
      }
      if (scheduleMentsRows.length > 0) {
        business.detail.schedule.scheduleMent = scheduleMentsRows.map(
          BusinessHelper.toBusinessScheduleMent,
        );
      }

      return {
        status: HttpStatus.OK,
        message: '',
        data: business,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
