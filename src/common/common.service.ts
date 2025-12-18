import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import {
  BusinessServiceCategoryVO,
  BusinessServiceItemVO,
  CodeBusinessAreaVO,
  Image,
} from 'src/libs/types';
import { isEmpty, isNull } from 'src/libs/helpers';
import { AzureBlobService } from 'src/azure/blob.service';
import { DateTime } from 'luxon';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
@Injectable()
export class CommonService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly httpService: HttpService,
  ) {}

  async getBusinessAreaCode(type: string) {
    try {
      const areaList = await this.db
        .selectFrom('code_business_area')
        .selectAll()
        .execute();

      if (isEmpty(areaList)) {
        return {
          status: HttpStatus.OK,
          message: 'Area list not found.',
          data: {
            list: [],
          },
        };
      }

      let list: CodeBusinessAreaVO[] = [];
      list = areaList.map((area) => ({
        id: area.id,
        nameKo: area.name_ko,
        name: area.name,
      }));

      return {
        status: HttpStatus.OK,
        message: '',
        data: {
          list: list,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async getBusinessSubwayCode(type: string) {
    try {
      // const areaList = await this.db
      //   .selectFrom('code_business_subway')
      //   .selectAll()
      //   .execute();

      return {
        status: HttpStatus.OK,
        message: '',
        data: { list: [] },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async addCode(
    type: string,
    parentId?: number,
    id?: number,
    name?: string,
    nameKo?: string,
    description?: string,
    businessType?: string,
    image?: Image,
  ) {
    try {
      const uploadedFile = await this.azureBlobService.uploadFileImage(image);

      if (id == null) {
        if (type === 'serviceCategory') {
          await this.db
            .insertInto('code_business_service_category')
            .values({
              name: name,
              name_ko: nameKo,
              type: businessType,
            })
            .execute();
        } else if (type === 'serviceItem') {
          await this.db
            .insertInto('code_business_service_item')
            .values({
              category_id: parentId,
              name: name,
              name_ko: nameKo,
              description: description,
              url: uploadedFile?.url ?? null,
              upload_file_id: uploadedFile?.id ?? null,
            })
            .execute();
        }
      } else {
        if (type === 'serviceCategory') {
          await this.db
            .updateTable('code_business_service_category')
            .where('id', '=', id)
            .set({
              name: name,
              name_ko: nameKo,
              type: businessType,
            })
            .execute();
        } else if (type === 'serviceItem') {
          const updateData: any = {
            name,
            name_ko: nameKo,
            description,
            url: uploadedFile?.url
              ? uploadedFile.url
              : image?.url
                ? image.url
                : null,
            upload_file_id: uploadedFile?.id
              ? uploadedFile.id
              : image?.id
                ? image.id
                : null,
          };

          await this.db
            .updateTable('code_business_service_item')
            .where('id', '=', id)
            .set(updateData)
            .execute();
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

  async deleteCode(type: string, id: number) {
    try {
      if (type === 'serviceCategory') {
        const isExist = await this.db
          .selectFrom('business_service_category')
          .where('code_id', '=', id)
          .selectAll()
          .executeTakeFirst();
        if (isExist) {
          return {
            status: HttpStatus.CONFLICT,
            message: 'this code used',
          };
        }
        await this.db
          .deleteFrom('code_business_service_category')
          .where('id', '=', id)
          .execute();
      } else if (type === 'serviceItem') {
        const isExist = await this.db
          .selectFrom('business_service_item')
          .where('code_id', '=', id)
          .selectAll()
          .executeTakeFirst();
        if (isExist) {
          return {
            status: HttpStatus.CONFLICT,
            message: 'this code used',
          };
        }
        await this.db
          .deleteFrom('code_business_service_item')
          .where('id', '=', id)
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
  async getServiceCategory(type?: string, isAdmin?: boolean) {
    try {
      // 1. 카테고리 조회
      let query = this.db.selectFrom('code_business_service_category');
      if (type) {
        query = query.where('type', '=', type);
      }
      const categories = await query.selectAll().orderBy('order_seq').execute();
      if (isEmpty(categories)) {
        return {
          status: HttpStatus.OK,
          message: 'category list not found.',
          data: {
            list: [],
          },
        };
      }
      // 2. 아이템 조회
      const items = await this.db
        .selectFrom('code_business_service_item')
        .selectAll()
        .execute();

      // 3. items를 category_id 기준으로 그룹화
      const itemsByCategoryId = items.reduce<
        Record<string, BusinessServiceItemVO[]>
      >((acc, item) => {
        let image: Image | null = null;
        if (item.url != null && isAdmin === true) {
          image = {
            url: item.url,
            id: item.upload_file_id,
          };
        }
        const vo: BusinessServiceItemVO = {
          id: item.id,
          name: item.name,
          nameKo: item.name_ko,
          description: isAdmin === true ? item.description : null,
          image: image,
        };

        if (!acc[item.category_id]) {
          acc[item.category_id] = [];
        }
        acc[item.category_id].push(vo);

        return acc;
      }, {});

      // 4. 최종 CategoryVO 구성 + items 삽입
      const list: BusinessServiceCategoryVO[] = categories.map((c) => ({
        id: c.id,
        name: c.name,
        nameKo: c.name_ko,
        items: itemsByCategoryId[c.id] ?? [], // 없으면 빈 배열
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

  async addLog(userId: string, description: string) {
    try {
      await this.db
        .insertInto('user_action_log')
        .values({
          user_id: userId,
          description: description,
          log_at: DateTime.now().toJSDate(),
        })
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

  async getLog(page: number, userId?: string) {
    try {
      const pageSize = 100;
      const offset = (page - 1) * pageSize;

      let testUserIds: string[] = [];
      const testUsers = await this.db
        .selectFrom('user_tester_id')
        .selectAll()
        .execute();
      if (testUsers.length > 0) {
        testUserIds = testUsers.map((user) => user.user_id);
      }

      let query = this.db.selectFrom('user_action_log');
      if (!isNull(userId)) {
        query = query.where('user_id', '=', userId.toString());
      }
      if (testUserIds.length > 0) {
        query = query.where('user_id', 'not in', testUserIds);
      }
      const logs = await query
        .selectAll()
        .orderBy('id', 'desc') //최신이 위에 오도록
        .offset(offset) // = OFFSET {offset} ROWS
        .fetch(pageSize) // = FETCH NEXT {pageSize} ROWS ONLY
        .execute();
      return {
        status: HttpStatus.OK,
        message: '',
        data: logs,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
        data: [],
      };
    }
  }

  async getBusiness(page: number) {
    try {
      const pageSize = 100;
      const offset = (page - 1) * pageSize;

      const business = await this.db
        .selectFrom('business')
        .where('status', '=', 'publish')
        .select(['id', 'status', 'updated_at as updatedAt'])
        .orderBy('id', 'asc')
        .offset(offset) // = OFFSET {offset} ROWS
        .fetch(pageSize) // = FETCH NEXT {pageSize} ROWS ONLY
        .execute();
      return {
        status: HttpStatus.OK,
        message: '',
        data: business,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
        data: [],
      };
    }
  }
  async deleteTestLog(userId: string) {
    try {
      await this.db
        .deleteFrom('user_action_log')
        .where('user_id', '=', userId)
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
  async deleteKoreaLogs() {
    try {
      const url = `https://mvp-api-kr-evhedehrehhehbcc.koreacentral-01.azurewebsites.net/erp/korea`;
      const response = await firstValueFrom(this.httpService.get(url));
      if (response.data && response.data.list) {
        const list = response.data.list;
      }

      /*
      await this.db
        .deleteFrom('user_action_log')
        .where('user_id', '=', userId)
        .execute();
        */
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
