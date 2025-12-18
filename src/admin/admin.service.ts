import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import {
  BusinessVO,
  Subway,
  DTO,
  BusinessServiceCategoryVO,
  BusinessServiceItemVO,
  BusinessSectionVO,
  BusinessMemberVO,
  BusinessReviewVO,
  BusinessScheduleVO,
  BusinessPriceVO,
  Image,
  BusinessDetailVO,
  BusinessType,
  BusinessStatusType,
  BusinessSectionType,
  isValidBusinessSectionType,
  isValidBusinessReviewType,
  BusinessReviewType,
} from 'src/libs/types';
import { isEmpty, isNull } from 'src/libs/helpers';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';
import { DB } from 'src/libs/db/types';
import { AdminRepository } from './admin.repository';
import {
  BusinessHelper,
  BusinessSubwayJoined,
} from 'src/business/business.helper';
import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';
import { DateTime } from 'luxon';
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly adminRepository: AdminRepository,
  ) {}

  async getBusinessAdminList(
    type?: string,
    name?: string,
    status?: string,
    page?: string,
    areaIds?: number[],
    order?: string,
  ) {
    try {
      let query = this.db
        .selectFrom('business as b')
        .leftJoin('business_detail as bd', 'b.id', 'bd.id')
        .leftJoin('code_business_area as cba', 'b.area_id', 'cba.id');

      if (!isEmpty(type)) {
        query = query.where('b.type', '=', type);
      }

      if (!isEmpty(name)) {
        query = query.where((eb) =>
          eb.or([
            eb('b.name', 'like', `%${name}%`),
            eb('b.name_ko', 'like', `%${name}%`),
          ]),
        );
      }

      if (!isEmpty(status)) {
        if (status === 'waiting') {
          query = query.where('b.status', '=', 'waiting');
        } else if (status === 'publish') {
          query = query.where('b.status', '=', 'publish');
        }
      }
      if (!isEmpty(areaIds) && areaIds.length > 0) {
        query = query.where('b.area_id', 'in', areaIds);
      }

      const itemsPerPage = 50;

      if (!isEmpty(order)) {
        if (order === 'rank') {
          query = query
            .orderBy('b.rank', 'desc') //랭킹 점수가 큰 값(ex. 9999)이 먼저 나오도록
            .orderBy('b.id', 'asc'); //랭킹 점수가 만약 같다면, id가 작은 값(=먼저 등록된)의 업체가 먼저 나오도록
        }
      } else {
        query = query.orderBy('b.id', 'desc');
      }

      const businessList = await query
        .select([
          'b.id',
          'b.type',
          'b.name',
          'b.name_ko',
          'cba.name_ko as area_name_ko',
          'cba.id as area_id',
          'bd.address_korea',
          'b.rank',
          'b.status',
          'b.curation_price',
          'b.curation_traffic',
          'b.curation_service',
          'b.line_url',
          'b.access_info',
          'b.x',
          'b.y',
        ])
        .execute();

      if (businessList.length === 0) {
        return {
          status: HttpStatus.OK,
          message: '',
          data: {
            list: [],
            count: 0,
          },
        };
      }

      let count = businessList.length;

      let numPage: number;
      if (page) {
        numPage = parseInt(page);
      }

      const midResult = !page
        ? businessList
        : businessList.slice(
            (numPage - 1) * itemsPerPage,
            numPage * itemsPerPage,
          );

      if (midResult.length === 0) {
        return {
          status: HttpStatus.OK,
          message: '',
          data: {
            list: [],
            count: 0,
          },
        };
      }

      const result = midResult.map((el) => {
        const business: BusinessVO = {
          id: el.id,
          type: el.type as BusinessType,
          name: el.name,
          nameKo: el.name_ko,
          area: {
            id: el.area_id,
            nameKo: el.area_name_ko,
          },
          rank: el.rank,
          status: el.status as BusinessStatusType,
          detail: {
            addressKorea: el.address_korea,
          } as BusinessDetailVO,
          curationPrice: el.curation_price,
          curationTraffic: el.curation_traffic,
          curationService: el.curation_service,
          lineUrl: el.line_url,
          accessInfo: el.access_info,
          x: el.x,
          y: el.y,
        } as BusinessVO;
        return business;
      });

      return {
        status: HttpStatus.OK,
        message: '',
        data: {
          list: result,
          count: count,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async createBusinessAdmin(business: BusinessVO) {
    try {
      let businessId: number | null = null;

      //business 테이블 add 부분
      await this.db.startTransaction(async (trx) => {
        const result = await trx
          .insertInto('business')
          .values({
            type: business.type,
            area_id: business.areaId,
            name: business.name,
            name_ko: business.nameKo,
            curation_price: business.curationPrice,
            curation_traffic: business.curationTraffic,
            curation_service: business.curationService,
            rank: business.rank,
            line_url: business.lineUrl,
            access_info: business.accessInfo,
            x: business.x ? parseFloat(business.x?.toString()) : null,
            y: business.y ? parseFloat(business.y?.toString()) : null,
            status:
              business.status === null || business.status === undefined
                ? 'waiting'
                : (business.status as BusinessStatusType),
            updated_at: new Date(),
          })
          .outputAll('inserted')
          .executeTakeFirst();

        businessId = result?.id;

        if (!isNull(businessId)) {
          const { status, message } = await this.updateBusiness(
            businessId,
            business,
          );

          if (status !== HttpStatus.OK) {
            throw new HttpException(message, status);
          }
        }
      });

      return {
        status: HttpStatus.OK,
        message: '',
        data: {
          item: null,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async updateBusiness(businessId: number, business: BusinessVO) {
    try {
      const existingBusiness = await this.db
        .selectFrom('business')
        .where('id', '=', businessId)
        .selectAll()
        .executeTakeFirst();
      if (!existingBusiness) {
        throw new NotFoundException('Business not found.');
      }

      //business_detail 테이블 add 부분
      //business 테이블의 id를 가지고 넣어줘야 한다.
      //없으면 추가 있으면 수정
      const businessDetail = await this.db
        .selectFrom('business_detail')
        .where('id', '=', businessId)
        .selectAll()
        .executeTakeFirst();
      if (!businessDetail) {
        await this.db
          .insertInto('business_detail')
          .values({
            id: businessId,
          })
          .execute();
      }

      if (!isNull(business.detail)) {
        const { status, message } = await this.updateBusinessInfo(businessId, {
          detail: {
            taxBenefit: business.detail.taxBenefit,
            addressKorea: business.detail.addressKorea,
            addressJapan: business.detail.addressJapan,
            sections: business.detail.sections,
            members: business.detail.members,
            reviews: business.detail.reviews,
            schedule: business.detail.schedule,
            price: business.detail.price,
          },
        } as BusinessVO);
        if (status !== HttpStatus.OK) {
          throw new HttpException(message, status);
        }
      }

      //business_subway 테이블 add 부분
      //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
      //이때 business 테이블의 id 값은 필수
      if (!isNull(business.subway) && business.subway.length >= 0) {
        const { status, message } = await this.updateBusinessInfo(businessId, {
          subway: business.subway,
        } as BusinessVO);

        if (status !== HttpStatus.OK) {
          throw new HttpException(message, status);
        }
      }

      //business_service_category 테이블 add 부분
      //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
      //이때 business 테이블의 id 값은 필수
      if (
        !isNull(business.serviceItemIds) &&
        business.serviceItemIds.length >= 0
      ) {
        const { status, message } = await this.updateBusinessInfo(businessId, {
          serviceItemIds: business.serviceItemIds,
        } as BusinessVO);

        if (status !== HttpStatus.OK) {
          throw new HttpException(message, status);
        }
      }

      //business_images 테이블 add 부분
      //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
      //이때 business 테이블의 id 값은 필수
      //upload_file 테이블에도 add해줘야 한다.
      if (!isNull(business.images) && business.images.length >= 0) {
        const { status, message } = await this.updateBusinessImages(
          businessId,
          business.images,
        );
        if (status !== HttpStatus.OK) {
          throw new HttpException(message, status);
        }
      }

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async updateBusinessDefault(businessId: number, business: BusinessVO): DTO {
    try {
      const existingBusiness = await this.db
        .selectFrom('business')
        .where('id', '=', businessId)
        .selectAll()
        .executeTakeFirst();
      if (!existingBusiness) {
        throw new NotFoundException('Business not found.');
      }

      const _business: UpdateObjectExpression<DB, 'business', 'business'> = {};
      _business.updated_at = new Date();
      if (!isEmpty(business.type)) {
        _business.type = business.type as BusinessType;
      } else {
        _business.type = null;
      }

      if (!isEmpty(business.areaId)) {
        _business.area_id = business.areaId as number;
      } else {
        _business.area_id = null;
      }

      if (!isEmpty(business.name)) {
        _business.name = business.name;
      } else {
        _business.name = null;
      }
      if (!isEmpty(business.nameKo)) {
        _business.name_ko = business.nameKo;
      } else {
        _business.name_ko = null;
      }

      if (!isEmpty(business.curationPrice)) {
        _business.curation_price = business.curationPrice;
      } else {
        _business.curation_price = null;
      }

      if (!isEmpty(business.curationTraffic)) {
        _business.curation_traffic = business.curationTraffic;
      } else {
        _business.curation_traffic = null;
      }

      if (!isEmpty(business.curationService)) {
        _business.curation_service = business.curationService;
      } else {
        _business.curation_service = null;
      }

      if (!isEmpty(business.rank)) {
        _business.rank = business.rank;
      } else {
        _business.rank = null;
      }

      if (!isEmpty(business.lineUrl)) {
        _business.line_url = business.lineUrl;
      } else {
        _business.line_url = null;
      }

      if (!isEmpty(business.accessInfo)) {
        _business.access_info = business.accessInfo;
      } else {
        _business.access_info = null;
      }

      if (!isEmpty(business.x)) {
        if (parseFloat(business.x?.toString())) {
          _business.x = parseFloat(business.x?.toString());
        }
      } else {
        _business.x = null;
      }

      if (!isEmpty(business.y)) {
        if (parseFloat(business.y?.toString())) {
          _business.y = parseFloat(business.y?.toString());
        }
      } else {
        _business.y = null;
      }

      if (!isEmpty(business.status)) {
        _business.status = business.status as BusinessStatusType;
      } else {
        _business.status = null;
      }

      await this.db.startTransaction(async (trx) => {
        await trx
          .updateTable('business')
          .set(_business)
          .where('id', '=', businessId)
          .execute();
      });

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      console.error(error);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
      };
    }
  }

  async updateBusinessInfo(businessId: number, business: BusinessVO): DTO {
    try {
      const _businessDetail: UpdateObjectExpression<
        DB,
        'business_detail',
        'business_detail'
      > = {};
      if (!isNull(business.detail)) {
        if (!isEmpty(business.detail?.taxBenefit)) {
          _businessDetail.tax_benefit = business.detail?.taxBenefit;
        } else {
          _businessDetail.tax_benefit = null;
        }

        if (!isEmpty(business.detail?.addressKorea)) {
          _businessDetail.address_korea = business.detail?.addressKorea;
        } else {
          _businessDetail.address_korea = null;
        }

        if (!isEmpty(business.detail?.addressJapan)) {
          _businessDetail.address_japan = business.detail?.addressJapan;
        } else {
          _businessDetail.address_japan = null;
        }

        if (
          !isEmpty(business.detail?.taxBenefit) ||
          !isEmpty(business.detail?.addressKorea) ||
          !isEmpty(business.detail?.addressJapan)
        ) {
          await this.db
            .updateTable('business_detail')
            .set(_businessDetail)
            .where('id', '=', businessId)
            .execute();
        }

        //business_section 테이블 add 부분
        //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
        //이때 business 테이블의 id 값은 필수
        if (
          !isNull(business.detail.sections) &&
          business.detail.sections.length >= 0
        ) {
          await this.updateBusinessSections(
            businessId,
            business.detail.sections,
          );
        }

        if (
          !isNull(business.detail.members) &&
          business.detail.members.length >= 0
        ) {
          await this.updateBusinessMembers(businessId, business.detail.members);
        }

        if (
          !isNull(business.detail.reviews) &&
          business.detail.reviews.length >= 0
        ) {
          await this.updateBusinessReviews(businessId, business.detail.reviews);
        }

        if (!isNull(business.detail.schedule)) {
          await this.updateBusinessSchedule(
            businessId,
            business.detail.schedule,
          );
        }

        if (
          !isNull(business.detail.price) &&
          business.detail.price.length >= 0
        ) {
          await this.updateBusinessPrices(businessId, business.detail.price);
        }
      }

      if (!isNull(business.subway) && business.subway.length >= 0) {
        await this.updateBusinessSubway(businessId, business.subway);
      }

      if (
        !isNull(business.serviceItemIds) &&
        business.serviceItemIds.length >= 0
      ) {
        await this.updateBusinessServiceCategory(
          businessId,
          business.serviceItemIds,
        );
      }

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      console.error(error);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
      };
    }
  }

  async updateBusinessSubway(businessId: number, subway: string[]) {
    if (!isNull(subway) && subway.length >= 0) {
      const pastBusinessSubway = await this.db
        .selectFrom('business_subway')
        .where('business_id', '=', businessId)
        .selectAll()
        .execute();
      if (pastBusinessSubway.length > 0) {
        await this.db
          .deleteFrom('business_subway')
          .where('business_id', '=', businessId)
          .execute();
      }
      if (subway.length > 0) {
        for (const item of subway) {
          await this.db
            .insertInto('business_subway')
            .values({
              business_id: businessId,
              subway_id: item as Subway,
            })
            .execute();
        }
      }
    }
  }

  async updateBusinessServiceCategory(
    businessId: number,
    serviceItemIds: number[],
  ) {
    //기존 데이터 초기화
    const pastBusinessServiceCategory = await this.db
      .selectFrom('business_service_category')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessServiceCategory.length > 0) {
      await this.db
        .deleteFrom('business_service_category')
        .where('business_id', '=', businessId)
        .execute();
    }
    const pastBusinessServiceItem = await this.db
      .selectFrom('business_service_item')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessServiceItem.length > 0) {
      await this.db
        .deleteFrom('business_service_item')
        .where('business_id', '=', businessId)
        .execute();
    }

    if (serviceItemIds.length > 0) {
      const categories = await this.db
        .selectFrom('code_business_service_item')
        .where('id', 'in', serviceItemIds)
        .selectAll()
        .execute();

      for (const serviceItemId of serviceItemIds) {
        let categoryCodeId: number | null = null;
        let categoryId: number | null = null;
        const category = categories.find((item) => item.id === serviceItemId);
        if (category) {
          categoryCodeId = category.category_id;
        }
        const businessServiceCategory = await this.db
          .selectFrom('business_service_category')
          .where('business_id', '=', businessId)
          .where('code_id', '=', categoryCodeId)
          .selectAll()
          .executeTakeFirst();
        if (businessServiceCategory) {
          categoryId = businessServiceCategory.code_id;
          await this.updateBusinessServiceItem(
            businessId,
            categoryId,
            serviceItemId,
          );
        } else {
          const result = await this.db
            .insertInto('business_service_category')
            .values({
              business_id: businessId,
              code_id: categoryCodeId,
            })
            .outputAll('inserted')
            .executeTakeFirst();
          if (result) {
            categoryId = result.code_id;
            await this.updateBusinessServiceItem(
              businessId,
              categoryId,
              serviceItemId,
            );
          }
        }
      }
    }
  }

  async updateBusinessServiceItem(
    businessId: number,
    categoryId: number,
    serviceItemId: number,
  ) {
    await this.db
      .insertInto('business_service_item')
      .values({
        business_id: businessId,
        category_id: categoryId,
        code_id: serviceItemId,
      })
      .execute();
  }

  async updateBusinessSections(
    businessId: number,
    sections?: BusinessSectionVO[],
  ) {
    const pastBusinessSection = await this.db
      .selectFrom('business_section')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessSection.length > 0) {
      await this.db
        .deleteFrom('business_section')
        .where('business_id', '=', businessId)
        .execute();
    }

    if (!isEmpty(sections) && sections.length > 0) {
      for (const item of sections) {
        if (!isValidBusinessSectionType(item.type as string)) {
          continue;
        }
        if (!isNull(item.ments) && item.ments.length > 0) {
          for (const _ment of item.ments) {
            await this.db
              .insertInto('business_section')
              .values({
                business_id: businessId,
                type: item.type as BusinessSectionType,
                ment: _ment,
              })
              .execute();
          }
        }
      }
    }
  }

  async updateBusinessImages(businessId: number, images?: Image[]) {
    let maintainImageIds: number[] = [];
    if (
      !isNull(images) &&
      images.filter((item) => !isEmpty(item.id)).length > 0
    ) {
      maintainImageIds.push(
        ...images
          .filter((item) => !isEmpty(item.id))
          .map((item) => Number(item.id)),
      );
    }
    if (maintainImageIds.length > 0) {
      await this.db
        .deleteFrom('business_images')
        .where('business_id', '=', businessId)
        .where('id', 'not in', maintainImageIds)
        .execute();
    } else {
      await this.db
        .deleteFrom('business_images')
        .where('business_id', '=', businessId)
        .execute();
    }
    let lastOrderSeq: number = 1;
    const pastBusinessImages = await this.db
      .selectFrom('business_images')
      .where('business_id', '=', businessId)
      .orderBy('order_seq', 'desc')
      .selectAll()
      .executeTakeFirst();
    if (pastBusinessImages) {
      lastOrderSeq = pastBusinessImages.order_seq + 1;
    }
    for (const item of images) {
      if (!isEmpty(item.data)) {
        const { uploadFileId, url } =
          await this.adminRepository.uploadBusinessImages(
            'business-images',
            item,
          );
        await this.db
          .insertInto('business_images')
          .values({
            business_id: businessId,
            url: url,
            upload_file_id: uploadFileId,
            order_seq: lastOrderSeq,
          })
          .execute();
        lastOrderSeq++;
      }
    }
    return {
      status: HttpStatus.OK,
      message: '',
    };
  }

  async updateBusinessMembers(
    businessId: number,
    members?: BusinessMemberVO[],
  ) {
    const prevMembers = await this.db
      .selectFrom('business_member')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();

    if (prevMembers.length > 0) {
      await this.db
        .deleteFrom('business_member')
        .where('business_id', '=', businessId)
        .execute();
    }

    if (!isNull(members) && members.length > 0) {
      for (const item of members) {
        if (item.profileImage) {
          if (
            !isEmpty(item.profileImage.id) ||
            !isEmpty(item.profileImage.url)
          ) {
            //이미지 유지
            if (item.name || item.grade || item.job) {
              await this.db
                .insertInto('business_member')
                .values({
                  business_id: businessId,
                  upload_file_id: item.profileImage.id,
                  profile_url: item.profileImage.url,
                  name: item.name,
                  grade: item.grade,
                  job: item.job,
                })
                .execute();
            }
          } else if (!isEmpty(item.profileImage.data)) {
            //이미지 추가
            const { uploadFileId, url } =
              await this.adminRepository.uploadBusinessMemberImages(
                'business-images',
                item.profileImage,
              );
            await this.db
              .insertInto('business_member')
              .values({
                business_id: businessId,
                upload_file_id: uploadFileId,
                profile_url: url,
                name: item.name,
                grade: item.grade,
                job: item.job,
              })
              .execute();
          }
        } else {
          await this.db
            .insertInto('business_member')
            .values({
              business_id: businessId,
              upload_file_id: null,
              profile_url: null,
              name: item.name,
              grade: item.grade,
              job: item.job,
            })
            .execute();
        }
      }
    }
  }

  //updateBusinessReviews
  async updateBusinessReviews(
    businessId: number,
    reviews?: BusinessReviewVO[],
  ) {
    const pastBusinessReviews = await this.db
      .selectFrom('business_review')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessReviews.length > 0) {
      await this.db
        .deleteFrom('business_review')
        .where('business_id', '=', businessId)
        .execute();
    }

    if (!isEmpty(reviews)) {
      //business_review 테이블 add 부분
      //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
      //이때 business 테이블의 id 값은 필수
      let hasGoogleReviewUrl = false;
      let googleReviewUrl: string | null = null;
      let hasNaverReviewUrl = false;
      let naverReviewUrl: string | null = null;
      for (const item of reviews) {
        if (!isValidBusinessReviewType(item.type as string)) {
          continue;
        }
        if (!isNull(item.list) && item.list.length > 0) {
          for (const _item of item.list) {
            if (item.type === 'google' && !isNull(item.linkUrl)) {
              hasGoogleReviewUrl = true;
              googleReviewUrl = item.linkUrl;
            } else if (item.type === 'naver' && !isNull(item.linkUrl)) {
              hasNaverReviewUrl = true;
              naverReviewUrl = item.linkUrl;
            }
            // "yyyy-MM-dd" 형식의 날짜를 파싱하여 시간을 0시 0분으로 설정
            const createdAtDate = _item.createdAt
              ? DateTime.fromFormat(_item.createdAt, 'yyyy-MM-dd', {
                  zone: 'utc',
                })
                  .startOf('day')
                  .toJSDate()
              : null;

            await this.db
              .insertInto('business_review')
              .values({
                business_id: businessId,
                type: item.type as BusinessReviewType,
                ment: _item.ment,
                created_at: createdAtDate,
              })
              .execute();
          }
        }
      }
      if (hasGoogleReviewUrl) {
        await this.updateBusinessReview(businessId, 'google', googleReviewUrl);
      }
      if (hasNaverReviewUrl) {
        await this.updateBusinessReview(businessId, 'naver', naverReviewUrl);
      }
    }
  }

  async updateBusinessReview(
    businessId: number,
    type: 'google' | 'naver',
    reviewUrl: string | null,
  ) {
    const existingBusinessDetail = await this.db
      .selectFrom('business_detail')
      .where('id', '=', businessId)
      .selectAll()
      .executeTakeFirst();
    if (!existingBusinessDetail) {
      await this.db
        .insertInto('business_detail')
        .values({
          id: businessId,
        })
        .execute();
    }
    if (!isNull(reviewUrl)) {
      if (type === 'google') {
        await this.db
          .updateTable('business_detail')
          .set({
            review_google_url: reviewUrl,
          })
          .where('id', '=', businessId)
          .execute();
      } else if (type === 'naver') {
        await this.db
          .updateTable('business_detail')
          .set({
            review_naver_url: reviewUrl,
          })
          .where('id', '=', businessId)
          .execute();
      }
    }
  }

  //updateBusinessSchedule
  async updateBusinessSchedule(
    businessId: number,
    schedule?: BusinessScheduleVO,
  ) {
    const pastBusinessScheduleHours = await this.db
      .selectFrom('business_schedule_hours')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessScheduleHours.length > 0) {
      await this.db
        .deleteFrom('business_schedule_hours')
        .where('business_id', '=', businessId)
        .execute();
    }

    const pastBusinessScheduleMents = await this.db
      .selectFrom('business_schedule_ments')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessScheduleMents.length > 0) {
      await this.db
        .deleteFrom('business_schedule_ments')
        .where('business_id', '=', businessId)
        .execute();
    }

    const pastBusinessScheduleExceptionRecurring = await this.db
      .selectFrom('business_schedule_exception_recurring')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessScheduleExceptionRecurring.length > 0) {
      await this.db
        .deleteFrom('business_schedule_exception_recurring')
        .where('business_id', '=', businessId)
        .execute();
    }

    const pastBusinessScheduleBreaks = await this.db
      .selectFrom('business_schedule_breaks')
      .where('business_id', '=', businessId)
      .selectAll()
      .execute();
    if (pastBusinessScheduleBreaks.length > 0) {
      await this.db
        .deleteFrom('business_schedule_breaks')
        .where('business_id', '=', businessId)
        .execute();
    }

    if (
      !isEmpty(schedule?.scheduleHours) &&
      schedule?.scheduleHours?.length > 0
    ) {
      const hoursValues = schedule.scheduleHours.flatMap((item) => {
        const open = item.openTime;
        const close = item.closeTime;
        const deadline = item.bookingDeadline;

        // 값 없으면 그냥 1건 처리
        if (!open || !close) {
          return [
            {
              business_id: businessId,
              weekday: item.weekday,
              open_time: open ?? null,
              close_time: close ?? null,
              booking_deadline: deadline ?? null,
              is_open: item.isOpen,
            },
          ];
        }

        // 정상 케이스 (당일 오픈 → 당일 마감)
        if (open < close) {
          return [
            {
              business_id: businessId,
              weekday: item.weekday,
              open_time: open,
              close_time: close,
              booking_deadline: deadline ?? null,
              is_open: item.isOpen,
            },
          ];
        }

        // *** 여기부터 다음날까지 넘어가는 케이스 ***
        // open > close 이면 두 구간으로 분리

        // deadline 이 어느 구간에 속하는지 판단
        let firstDeadline = null;
        let secondDeadline = null;

        if (deadline) {
          // deadline 이 close 시간보다 이후면 (예: 23:30) → 1구간
          if (deadline > close) {
            firstDeadline = deadline;
          }
          // deadline 이 close 보다 이전이면 (예: 00:30) → 2구간
          else {
            secondDeadline = deadline;
          }
        }

        return [
          {
            business_id: businessId,
            weekday: item.weekday,
            open_time: open,
            close_time: '23:59',
            booking_deadline: firstDeadline,
            is_open: item.isOpen,
          },
          {
            business_id: businessId,
            weekday: item.weekday, // 필요하면 다음날로 바꿔줄 수도 있음
            open_time: '00:00',
            close_time: close,
            booking_deadline: secondDeadline,
            is_open: item.isOpen,
          },
        ];
      });
      await this.db
        .insertInto('business_schedule_hours')
        .values(hoursValues)
        .execute();
    }

    // 3. Business Schedule Exception Recurring 처리
    if (
      !isEmpty(schedule.scheduleException) &&
      schedule.scheduleException.length > 0
    ) {
      const exceptionValues = schedule.scheduleException.map((item) => ({
        business_id: businessId,
        weekday: item.weekday,
        nth_week: item.nthWeek,
        is_open: item.isOpen,
        open_time: item.openTime ?? null,
        close_time: item.closeTime ?? null,
      }));

      await this.db
        .insertInto('business_schedule_exception_recurring')
        .values(exceptionValues)
        .execute();
    }

    // 4. Business Schedule Breaks 처리
    if (
      !isEmpty(schedule.scheduleBreaks) &&
      schedule.scheduleBreaks.length > 0
    ) {
      const breakValues = schedule.scheduleBreaks.map((item) => ({
        business_id: businessId,
        //type: item.type ?? null,
        weekday: item.weekday,
        is_open: item.isOpen ?? null,
        open_time: item.openTime ?? null,
        close_time: item.closeTime ?? null,
      }));

      await this.db
        .insertInto('business_schedule_breaks')
        .values(breakValues)
        .execute();
    }

    // business_schedule_ments 테이블 add 부분
    if (!isEmpty(schedule.scheduleMent) && schedule.scheduleMent.length > 0) {
      const mentValues = schedule.scheduleMent.map((item) => ({
        business_id: businessId,
        ment: item,
      }));

      await this.db
        .insertInto('business_schedule_ments')
        .values(mentValues)
        .execute();
    }
  }
  //updateBusinessPrices
  async updateBusinessPrices(businessId: number, prices?: BusinessPriceVO[]) {
    // 기존 데이터 삭제
    const pastBusinessPrices = await this.db
      .selectFrom('business_price_category')
      .where('business_id', '=', businessId)
      .select('id')
      .execute();
    if (pastBusinessPrices.length > 0) {
      const categoryIds = pastBusinessPrices.map((x) => x.id);
      await this.db
        .deleteFrom('business_price_item')
        .where('category_id', 'in', categoryIds)
        .execute();
      await this.db
        .deleteFrom('business_price_category')
        .where('business_id', '=', businessId)
        .execute();
    }

    // 새로운 데이터 입력
    let categoryOrderSeq: number = 1;
    for (const priceCategory of prices) {
      let categoryId: number | null = null;
      //business_price_category 테이블 add 부분
      const result = await this.db
        .insertInto('business_price_category')
        .values({
          business_id: businessId,
          name: priceCategory.name,
          order_seq: categoryOrderSeq,
          category_id: priceCategory.categoryId,
        })
        .outputAll('inserted')
        .executeTakeFirst();
      if (result) {
        categoryId = result.id;
        categoryOrderSeq++;
        if (!priceCategory.list || priceCategory.list.length === 0) {
          continue;
        }

        let itemOrderSeq: number = 1;
        let subCategoryOrderSeq: number = 1;
        //business_price_item 테이블 add 부분
        //리스트로 값이 들어오면 기존 값은 지우고 다시 추가한다.
        //이때 business_price_category 테이블의 id 값은 필수
        for (const item of priceCategory.list) {
          const result2 = await this.db
            .insertInto('business_price_category')
            .values({
              parent_id: categoryId,
              business_id: businessId,
              name: item.name,
              order_seq: subCategoryOrderSeq,
            })
            .outputAll('inserted')
            .executeTakeFirst();

          subCategoryOrderSeq++;

          if (result2 && item.list && item.list.length > 0) {
            let categoryId2 = result2.id;
            let subItemOrderSeq = 1;

            for (const item2 of item.list) {
              await this.db
                .insertInto('business_price_item')
                .values({
                  category_id: categoryId2,
                  name: item2.name,
                  price:
                    item2.price === undefined ||
                    item2.price === null ||
                    item2.price === 0
                      ? null
                      : (item2.price as number),

                  min_price:
                    item2.minPrice === undefined ||
                    item2.minPrice === null ||
                    item2.minPrice === 0
                      ? null
                      : (item2.minPrice as number),

                  max_price:
                    item2.maxPrice === undefined ||
                    item2.maxPrice === null ||
                    item2.maxPrice === 0
                      ? null
                      : (item2.maxPrice as number),
                  order_seq: subItemOrderSeq,
                })
                .execute();
              subItemOrderSeq++;
            }
          }
        }
      }
    }
  }

  async updateBusinessAdmin(business: BusinessVO) {
    try {
      if (isEmpty(business.id)) {
        throw new BadRequestException('business.id is required.');
      }

      const { status: status_1, message: message_1 } =
        await this.updateBusinessDefault(business.id as number, business);
      if (status_1 !== HttpStatus.OK) {
        throw new HttpException(message_1, status_1);
      }

      const { status: status_2, message: message_2 } =
        await this.updateBusiness(business.id as number, business);
      if (status_2 !== HttpStatus.OK) {
        throw new HttpException(message_2, status_2);
      }

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async publishBusinessAdmin(id: number) {
    try {
      const business = await this.db
        .selectFrom('business')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      if (!business) {
        throw new NotFoundException('Business not found.');
      }

      if (business.status === 'publish') {
        throw new BadRequestException('Business is already published.');
      }
      await this.db
        .updateTable('business')
        .set({
          status: 'publish',
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async publishBusinessAdminBack(id: number) {
    try {
      const business = await this.db
        .selectFrom('business')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      if (!business) {
        throw new NotFoundException('Business not found.');
      }

      if (business.status === 'waiting') {
        throw new BadRequestException('Business is not published.');
      }
      await this.db
        .updateTable('business')
        .set({
          status: 'waiting',
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  //deleteBusinessAdmin
  async deleteBusinessAdmin(id: number) {
    try {
      const business = await this.db
        .selectFrom('business')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();

      if (!business) {
        throw new NotFoundException('Business not found.');
      }
      await this.db
        .deleteFrom('business_detail')
        .where('id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_images')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_member')
        .where('business_id', '=', id)
        .execute();
      const businessPriceCategory = await this.db
        .selectFrom('business_price_category')
        .where('business_id', '=', id)
        .select(['id'])
        .execute();

      if (businessPriceCategory.length > 0) {
        const businessPriceCategoryIds = businessPriceCategory.map(
          (category) => category.id,
        );
        await this.db
          .deleteFrom('business_price_item')
          .where('category_id', 'in', businessPriceCategoryIds)
          .execute();
      }
      await this.db
        .deleteFrom('business_price_category')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_review')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_schedule_breaks')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_schedule_exception_recurring')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_schedule_hours')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_schedule_ments')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_section')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_service_category')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_service_item')
        .where('business_id', '=', id)
        .execute();
      await this.db
        .deleteFrom('business_subway')
        .where('business_id', '=', id)
        .execute();
      await this.db.deleteFrom('business').where('id', '=', id).execute();
      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async setBusinessRankAdmin(id: number, _rank: number) {
    try {
      const business = await this.db
        .selectFrom('business')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();

      if (!business) {
        throw new NotFoundException('Business not found.');
      }

      if (!isEmpty(_rank)) {
        await this.db
          .updateTable('business')
          .set({
            rank: _rank,
          })
          .where('id', '=', business.id)
          .execute();
      }
      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
