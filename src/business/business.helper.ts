import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';
import { DB } from 'src/libs/db/types';
import {
  BusinessDetailVO,
  BusinessMemberVO,
  BusinessPriceVO,
  BusinessReviewVO,
  BusinessScheduleBreaksVO,
  BusinessScheduleExceptionRecurringVO,
  BusinessScheduleHoursVO,
  BusinessSectionVO,
  BusinessServiceItemVO,
  BusinessStatusType,
  BusinessType,
  BusinessVO,
  Image,
  BusinessReviewType,
} from 'src/libs/types';
import { DateTime } from 'luxon';

export type BusinessSubwayJoined = AllSelection<DB, 'business'> & {
  subway_id: string[];
  area_name_ko: string | null;
  area_name: string | null;
};
export class BusinessHelper {
  static toBusinessForAdmin(business: BusinessSubwayJoined): BusinessVO {
    return {
      id: business.id,
      type: business.type as BusinessType,
      images: [],
      name: business.name,
      nameKo: business.name_ko,
      subway: business.subway_id ?? [],
      accessInfo: business.access_info,
      curationPrice: business.curation_price,
      curationTraffic: business.curation_traffic,
      curationService: business.curation_service,
      lineUrl: business.line_url,
      x: business.x ? parseFloat(business.x?.toString()) : null,
      y: business.y ? parseFloat(business.y?.toString()) : null,
      serviceCategory: [],
      status: business.status as BusinessStatusType,
      detail: null,
      rank: business.rank,
      areaId: business.area_id,
      area: {
        id: business.area_id,
        nameKo: business.area_name_ko,
        name: business.area_name,
      },
    };
  }

  static toBusinessForUser(business: AllSelection<DB, 'business'>): BusinessVO {
    return {
      id: business.id,
      type: business.type as BusinessType,
      images: [],
      name: business.name,
      subway: [],
      accessInfo: business.access_info,
      curationPrice: business.curation_price,
      curationTraffic: business.curation_traffic,
      curationService: business.curation_service,
      lineUrl: business.line_url,
      x: business.x ? parseFloat(business.x?.toString()) : null,
      y: business.y ? parseFloat(business.y?.toString()) : null,
      serviceCategory: [],
      status: business.status as BusinessStatusType,
      detail: null,
    };
  }

  static toBusinessDetail(
    detail: AllSelection<DB, 'business_detail'>,
  ): BusinessDetailVO {
    return {
      id: detail.id,
      taxBenefit: detail.tax_benefit,
      addressKorea: detail.address_korea,
      addressJapan: detail.address_japan,
      sections: [],
      members: [],
      reviews: [],
      schedule: null,
      price: [],
    };
  }

  static toBusinessImages(image: AllSelection<DB, 'business_images'>): Image {
    return {
      id: image.id.toString(),
      url: image.url.toString(),
    };
  }

  static toBusinessServiceItem(item: {
    item_id: number | null;
    category_id: number | null;
    item_name?: string | null;
    item_name_ko?: string | null;
    item_description?: string | null;
    item_url?: string | null;
    item_upload_file_id?: string | null;
    item_upload_file_url?: string | null;
  }): BusinessServiceItemVO {
    let image: Image | null = null;
    if (item.item_upload_file_url) {
      image = {
        id: item.item_upload_file_id,
        url: item.item_upload_file_url,
      };
    }
    return {
      id: item.item_id,
      name: item.item_name ?? undefined,
      nameKo: item.item_name_ko ?? undefined,
      description: item.item_description ?? undefined,
      image: image,
    };
  }

  static toBusinessSection(
    sections: AllSelection<DB, 'business_section'>[],
  ): BusinessSectionVO[] {
    if (!sections || sections.length === 0) {
      return [];
    }

    // 1. Type을 키(Key)로 하여 멘트들을 모읍니다.
    const groupedMap = new Map<string, string[]>();

    sections.forEach((row) => {
      // type이나 ment가 null일 수 있는 경우 안전하게 처리
      const type = row.type ?? 'unknown';
      const ment = row.ment;

      if (!groupedMap.has(type)) {
        groupedMap.set(type, []);
      }

      if (ment) {
        groupedMap.get(type)!.push(ment);
      }
    });

    // 2. Map을 순회하며 VO 배열로 변환합니다.
    return Array.from(groupedMap.entries()).map(([type, ments]) => ({
      type: type,
      ments: ments,
    }));
  }
  static toBusinessMember(row: {
    name: string | null;
    grade: string | null;
    job: string | null;
    profile_image_id?: number | string | null;
    profile_image_url?: string | null;
  }): BusinessMemberVO {
    // 프로필 이미지가 있는 경우에만 Image 객체 생성
    let profileImage: Image | null = null;

    if (row.profile_image_url) {
      profileImage = {
        id: row.profile_image_id?.toString(),
        url: row.profile_image_url,
      };
    }

    return {
      name: row.name ?? null,
      grade: row.grade ?? null,
      job: row.job ?? null,
      profileImage: profileImage,
    };
  }
  static toBusinessReview(
    rows: AllSelection<DB, 'business_review'>[],
  ): BusinessReviewVO[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    // 1. Type을 기준으로 그룹핑하기 위한 Map 생성
    const reviewMap = new Map<string, BusinessReviewVO>();

    rows.forEach((row) => {
      const type = row.type ?? 'unknown'; // type이 null일 경우 대비

      // 2. 해당 Type의 그룹이 없으면 초기화
      if (!reviewMap.has(type)) {
        reviewMap.set(type, {
          type: type as BusinessReviewType,
          linkUrl: null, // DB에 link_url 컬럼이 있다고 가정 (VO에 있으므로)
          list: [],
        });
      }

      // 3. 리뷰 내용(Item) 추가
      // ment나 date가 있는 경우에만 list에 push
      if (row.ment) {
        const currentGroup = reviewMap.get(type)!;
        // Date를 "yyyy-MM-dd" 형식으로 포맷팅
        const formattedDate = row.created_at
          ? DateTime.fromJSDate(row.created_at, { zone: 'utc' }).toFormat(
              'yyyy-MM-dd',
            )
          : null;
        currentGroup.list!.push({
          ment: row.ment,
          createdAt: formattedDate,
        });
      }
    });

    // 4. Map의 값들만 추출하여 배열로 반환
    return Array.from(reviewMap.values());
  }

  static toBusinessPriceTree(
    categories: {
      id: number;
      parent_id: number | null;
      name: string | null;
      order_seq: number | null;
      category_id: number | null;
    }[],
    items: {
      id: number;
      category_id: number | null;
      name: string | null;
      price: number | null; // DB 타입에 맞춰 조정
      min_price: number | null;
      max_price: number | null;
      order_seq: number | null;
    }[],
  ): BusinessPriceVO[] {
    // 1. 빠른 접근을 위해 카테고리를 Map으로 변환 (ID -> VO)
    // 이때 VO를 미리 생성해둡니다.
    const categoryMap = new Map<
      number,
      BusinessPriceVO & { parentId: number | null }
    >();

    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        price: null, // 카테고리는 가격 없음
        list: [], // 여기에 SubCategory나 Item이 들어감
        parentId: cat.parent_id, // 조립용 임시 필드
        categoryId: cat.category_id,
      });
    });

    // 2. 아이템들을 각자의 카테고리(list)에 집어넣기
    items.forEach((item) => {
      if (item.category_id && categoryMap.has(item.category_id)) {
        const parentCategory = categoryMap.get(item.category_id)!;

        // 아이템을 VO 형태로 변환하여 부모 카테고리 list에 추가
        const itemVO: BusinessPriceVO = {
          id: item.id,
          name: item.name,
          price:
            item.price === undefined || item.price === null || item.price === 0
              ? null
              : (item.price as number), // 가격 문자열 변환
          minPrice:
            item.min_price === undefined ||
            item.min_price === null ||
            item.min_price === 0
              ? null
              : (item.min_price as number), // 가격 문자열 변환
          maxPrice:
            item.max_price === undefined ||
            item.max_price === null ||
            item.max_price === 0
              ? null
              : (item.max_price as number), // 가격 문자열 변환
          list: null, // 아이템은 하위 리스트 없음 (Leaf Node)
        };

        // list가 null일 수 있으므로 초기화 안전장치 (위에서 []로 초기화했지만 타입 안전성 위해)
        if (!parentCategory.list) parentCategory.list = [];
        parentCategory.list.push(itemVO);
      }
    });

    // 3. 카테고리끼리 계층 연결 (Sub -> Parent) 및 Root 추출
    const rootCategories: BusinessPriceVO[] = [];

    // Map에 있는 모든 카테고리를 순회
    for (const catVO of categoryMap.values()) {
      if (catVO.parentId === null) {
        // 부모가 없으면 최상위(Root) 카테고리
        rootCategories.push(catVO);
      } else {
        // 부모가 있으면, 부모 카테고리를 찾아서 그 list에 자신을 추가
        if (categoryMap.has(catVO.parentId)) {
          const parentCat = categoryMap.get(catVO.parentId)!;
          if (!parentCat.list) parentCat.list = [];

          // 부모의 list에 '나(Sub Category)'를 추가
          parentCat.list.push(catVO);
        }
      }
      // 조립이 끝났으므로 임시 필드인 parentId는 (원한다면) 제거하거나 무시됨 (VO 타입엔 없으므로)
    }

    // 4. (옵션) DB에서 정렬해 왔지만, 부모-자식 조립 순서에 따라 섞일 수 있으므로
    // 확실한 순서를 원한다면 여기서 정렬 로직을 추가할 수 있음.
    // 현재는 DB order_seq 순서대로 push 되었으므로 대체로 유지됨.

    return rootCategories;
  }

  private static formatTime(
    dateVal: Date | string | null | undefined,
  ): string | undefined {
    if (!dateVal) return undefined;

    // 만약 이미 문자열로 '18:00:00' 처럼 들어오는 경우 방어 로직
    if (typeof dateVal === 'string') {
      // 'Thu Jan 01...' 처럼 긴 문자열이면 Date로 변환 후 처리
      if (dateVal.length > 8) {
        const d = new Date(dateVal);
        return BusinessHelper.extractTimeFromDate(d);
      }
      return dateVal;
    }

    // Date 객체인 경우 시간 추출
    return BusinessHelper.extractTimeFromDate(dateVal);
  }

  private static extractTimeFromDate(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  static toBusinessScheduleHours(
    row: AllSelection<DB, 'business_schedule_hours'>,
  ): BusinessScheduleHoursVO {
    return {
      id: row.id,
      weekday: row.weekday,
      isOpen: !!row.is_open, // 0/1 또는 null을 boolean으로 안전하게 변환
      openTime: BusinessHelper.formatTime(row.open_time), // Time 컬럼은 문자열로 변환 필요 가능성 있음
      closeTime: BusinessHelper.formatTime(row.close_time),
      bookingDeadline: BusinessHelper.formatTime(row.booking_deadline),
    };
  }
  static mergeScheduleHours(list: BusinessScheduleHoursVO[]) {
    const result: BusinessScheduleHoursVO[] = [];

    const timeToMinutes = (t?: string | null) => {
      if (!t) return 0;
      const [hh, mm] = t.split(':').map((s) => Number(s));
      return hh * 60 + mm;
    };

    // weekday & openTime 오름차순 정렬 (단, 00:00(다음날)은 23:59 끝나는 구간 뒤로)
    const sorted = [...list].sort((a, b) => {
      if (a.weekday === b.weekday) {
        // 특수 케이스: a가 00:00이고 b가 23:59로 끝나면 b가 먼저
        if (a.openTime === '00:00' && b.closeTime === '23:59') return 1;
        if (b.openTime === '00:00' && a.closeTime === '23:59') return -1;

        // 일반적인 시간 비교 (null-safe)
        return timeToMinutes(a.openTime) - timeToMinutes(b.openTime);
      }
      return a.weekday - b.weekday;
    });

    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = result.length > 0 ? result[result.length - 1] : null;

      const isMergeCase =
        prev &&
        prev.weekday === cur.weekday &&
        prev.closeTime === '23:59' &&
        cur.openTime === '00:00';

      if (isMergeCase) {
        // prev 의 closeTime 을 두 번째 구간의 closeTime 으로 갱신
        prev.closeTime = cur.closeTime;

        // bookingDeadline 은 “실제 close 기준”이므로 cur 것이 맞음
        if (cur.bookingDeadline) {
          prev.bookingDeadline = cur.bookingDeadline;
        }
      } else {
        result.push({ ...cur });
      }
    }

    return result;
  }

  /**
   * 반복 예외 일정 (Schedule Exception Recurring)
   */
  static toBusinessScheduleExceptionRecurring(
    row: AllSelection<DB, 'business_schedule_exception_recurring'>,
  ): BusinessScheduleExceptionRecurringVO {
    return {
      id: row.id,
      weekday: row.weekday,
      nthWeek: row.nth_week,
      isOpen: !!row.is_open,
      openTime: BusinessHelper.formatTime(row.open_time),
      closeTime: BusinessHelper.formatTime(row.close_time),
    };
  }

  /**
   * 휴게 시간 (Schedule Breaks)
   */
  static toBusinessScheduleBreaks(
    row: AllSelection<DB, 'business_schedule_breaks'>,
  ): BusinessScheduleBreaksVO {
    return {
      id: row.id,
      //type: row.type,
      weekday: row.weekday,
      isOpen: row.is_open !== null ? !!row.is_open : null, // null 허용 필드인 경우 유지
      openTime: BusinessHelper.formatTime(row.open_time),
      closeTime: BusinessHelper.formatTime(row.close_time),
    };
  }

  /**
   * 스케줄 멘트 (단일 문자열 반환 -> Service에서 map으로 배열 완성)
   */
  static toBusinessScheduleMent(
    row: AllSelection<DB, 'business_schedule_ments'>,
  ): string {
    // DB 컬럼명이 ment라고 가정
    return row.ment ?? '';
  }
}
