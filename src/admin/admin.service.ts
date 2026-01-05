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
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly adminRepository: AdminRepository,
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
  async testKakao(userId: string, templateCode: string) {
    try {
      await this.kakaoService.sendKakaoNotification(
        userId,
        templateCode,
        null,
        [],
        [],
      );
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async generatePhotoAdminTest(image: Image, ment: string) {
    try {
      const url = await this.workerService.generatePhotoAdminTest(
        image.data,
        ment,
      );
      return {
        status: HttpStatus.OK,
        url,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
