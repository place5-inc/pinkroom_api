import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { DTO, Image } from 'src/libs/types';
import { isEmpty, isNull } from 'src/libs/helpers';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';
import { DB } from 'src/libs/db/types';
import { AdminRepository } from './admin.repository';

import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';
import { DateTime } from 'luxon';
import { AzureBlobService } from 'src/azure/blob.service';
import { KakaoService } from 'src/kakao/kakao.service';
import { PhotoWorkerService } from 'src/photo/photo-worker.service';
import { PhotoService } from 'src/photo/photo.service';
import { sql } from 'kysely';
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoService: PhotoService,
    private readonly azureBlobService: AzureBlobService,
    private readonly kakaoService: KakaoService,
    private readonly workerService: PhotoWorkerService,
  ) {}
  async test() {
    try {
      const test = await this.db
        .selectFrom('users')
        .selectAll()
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
        test,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async addStyle(name: string) {
    try {
      const result = await this.db
        .insertInto('code_hair_style')
        .values({
          name: name,
        })
        .outputAll('inserted')
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async updateStyle(id: number, name: string) {
    try {
      const result = await this.db
        .updateTable('code_hair_style')
        .set({
          name: name,
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async publishStyle(id: number, setOn: boolean) {
    try {
      const result = await this.db
        .updateTable('code_hair_style')
        .set({
          published_at: setOn ? new Date() : null,
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async addDesign(styleId: number, name: string) {
    try {
      const result = await this.db
        .insertInto('code_hair_design')
        .values({
          style_id: styleId,
          name: name,
        })
        .outputAll('inserted')
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async updateDesign(id: number, name: string) {
    try {
      const result = await this.db
        .updateTable('code_hair_design')
        .set({
          name: name,
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async publishDesign(id: number, setOn: boolean) {
    try {
      const result = await this.db
        .updateTable('code_hair_design')
        .set({
          published_at: setOn ? new Date() : null,
        })
        .where('id', '=', id)
        .execute();

      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async getPrompt(designId: number) {
    try {
      const item = await this.db
        .selectFrom('prompt')
        .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
        .where('prompt.design_id', '=', designId)
        .select([
          'prompt.design_id as designId',
          'prompt.ment',
          'upload_file.id as imageId',
          'upload_file.url as imageUrl',
        ])
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
        item: {
          designId: item?.designId,
          ment: item?.ment,
          image: item?.imageId
            ? {
                id: item.imageId,
                url: item.imageUrl,
              }
            : null,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async updatePrompt(designId: number, ment: string, image?: Image) {
    try {
      let uploadFileId = null;
      if (image) {
        if (image.data) {
          const uploadedFile =
            await this.azureBlobService.uploadFileImage(image);
          uploadFileId = uploadedFile.id;
        } else if (image.id) {
          uploadFileId = image.id;
        }
      }
      const updateResult = await this.db
        .updateTable('prompt')
        .set({ ment: ment, upload_file_id: uploadFileId })
        .where('design_id', '=', designId)
        .executeTakeFirst();

      if (updateResult.numUpdatedRows === 0n) {
        await this.db
          .insertInto('prompt')
          .values({
            design_id: designId,
            ment: ment,
            upload_file_id: uploadFileId,
          })
          .execute();
      }
      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async changePhone(before: string, after: string) {
    try {
      const beforeUser = await this.db
        .selectFrom('users')
        .where('phone', '=', before)
        .selectAll()
        .executeTakeFirst();
      if (!beforeUser) {
        throw new NotFoundException('before user not found');
      }
      const afterUser = await this.db
        .selectFrom('users')
        .where('phone', '=', after)
        .selectAll()
        .executeTakeFirst();
      if (afterUser) {
        throw new BadRequestException('after user already exists');
      }
      await this.db
        .updateTable('users')
        .set({ phone: after })
        .where('id', '=', beforeUser.id)
        .execute();
      return {
        status: HttpStatus.OK,
        message: 'phone changed successfully',
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async geminiReset() {
    await this.db
      .updateTable('gemini_key')
      .set({
        expired_at: null,
      })
      .execute();
  }
  async getCertiCode(phone: string) {
    const result = await this.db
      .selectFrom('user_certification')
      .where('phone_number', '=', phone)
      .orderBy('id desc')
      .selectAll()
      .executeTakeFirst();
    return {
      code: result.code,
    };
  }
  async getActionLog(page: number) {
    try {
      const pageSize = 100;
      const offset = (page - 1) * pageSize;
      let query = this.db.selectFrom('user_action_log');
      const logs = await query
        .select([
          'id',
          'phone',
          'pay_count as payCount',
          'view',
          'action',
          'log_at as logAt',
        ])
        .orderBy('id', 'desc') //최신이 위에 오도록
        .offset(offset) // = OFFSET {offset} ROWS
        .fetch(pageSize) // = FETCH NEXT {pageSize} ROWS ONLY
        .execute();
      return {
        status: HttpStatus.OK,
        data: logs,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async getPhotos(phone: string) {
    const user = await this.db
      .selectFrom('users')
      .where('phone', '=', phone)
      .selectAll()
      .executeTakeFirst();
    if (!user) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '유저가 없습니다.',
      };
    }

    return await this.photoService.getPhotoList(user.id);
  }
  async generatePhotoAdminTest(image: Image, ment: string, ai: string) {
    const uploadFile = await this.workerService.generatePhotoAdminTest(
      image,
      ment,
      ai,
    );
    return {
      status: HttpStatus.OK,
      url: uploadFile.url,
    };
  }
  async generateImage(photoId: number, designId: number) {
    try {
      const photo = await this.db
        .selectFrom('photos')
        .leftJoin('upload_file', 'upload_file.id', 'photos.upload_file_id')
        .where('photos.id', '=', photoId)
        .select('upload_file.url as url')
        .executeTakeFirst();
      const prompt = await this.db
        .selectFrom('prompt')
        .where('design_id', '=', designId)
        .selectAll()
        .executeTakeFirst();
      const image: Image = {
        url: photo.url,
      };
      const uploadFile = await this.workerService.generatePhotoAdminTest(
        image,
        prompt.ment,
        'gemini',
      );
      return {
        status: HttpStatus.OK,
        image: uploadFile,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async savePhotos(photoId: number, designId: number, imageId: string) {
    try {
      await this.db
        .updateTable('photo_results')
        .set({
          result_image_id: imageId,
          status: 'complete',
        })
        .where('original_photo_id', '=', photoId)
        .where('hair_design_id', '=', designId)
        .execute();

      const totalCount = await this.db
        .selectFrom('prompt')
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirst();
      const completed = await this.db
        .selectFrom('photo_results')
        .where('original_photo_id', '=', photoId)
        .where('status', '=', 'complete')
        .select('hair_design_id')
        .execute();
      const completedSet = new Set(completed.map((r) => r.hair_design_id));
      if (completedSet.size === totalCount.count) {
        await this.db
          .updateTable('photos')
          .set({
            status: 'complete',
          })
          .where('id', '=', photoId)
          .execute();
      }
      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
