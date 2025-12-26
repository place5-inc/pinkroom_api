import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { randomUUID } from 'crypto';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image } from 'src/libs/types';
import { GeminiService } from 'src/ai/gemini.service';
import { CommonService } from 'src/common/common.service';
@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly geminiService: GeminiService,
    private readonly commonService: CommonService,
  ) {}

  /* 
  유저가 사진 업로드
  */
  async uploadPhoto(
    userId: string,
    image: Image,
    designId: number,
    paymentId?: number,
    code?: string,
  ) {
    try {
      if (!paymentId && !code) {
        throw new BadRequestException(
          'paymentId 또는 code 중 하나는 반드시 필요합니다.',
        );
      }
      if (paymentId) {
        const payment = await this.db
          .selectFrom('payments')
          .where('id', '=', paymentId)
          .selectAll()
          .execute();
        if (!payment) {
          throw new NotFoundException('결제를 찾을 수 없습니다.');
        }
      }
      if (code) {
      }

      const uploadedFile = await this.azureBlobService.uploadFileImage(image);
      const photo = await this.db
        .insertInto('photos')
        .values({
          user_id: userId,
          upload_file_id: uploadedFile?.id ?? null,
          created_at: new Date(),
          payment_id: paymentId,
        })
        .output(['inserted.id'])
        .executeTakeFirst();

      const ment = await this.db
        .selectFrom('prompt')
        .where('design_id', '=', designId)
        .select('ment')
        .executeTakeFirst();
      if (!ment) {
        throw new NotFoundException('prompt를 찾을 수 없습니다.');
      }
      const result = await this.generatePhoto(
        photo.id,
        uploadedFile.url,
        designId,
        ment.ment,
        5,
      );
      if (result) {
        const photoResult = await this.db
          .selectFrom('photo_results')
          .where('id', '=', result.id)
          .selectAll()
          .executeTakeFirst();
        const resultUrl = await this.db
          .selectFrom('upload_file')
          .where('id', '=', photoResult.result_image_id)
          .selectAll()
          .executeTakeFirst();

        return {
          status: HttpStatus.OK,
          item: {
            id: result.id,
            url: resultUrl.url,
            designId: designId,
          },
        };
      }
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  /*
  이미 원본 있을 때, 하나의 디자인 만들기
   */
  async retryUploadPhoto(
    userId: string,
    originalPhotoId: number,
    designId: number,
  ) {
    const originalPhoto = await this.db
      .selectFrom('photos as p')
      .innerJoin('upload_file as u', 'u.id', 'p.upload_file_id')
      .where('p.id', '=', originalPhotoId)
      .select(['p.id as photo_id', 'u.url as url'])
      .executeTakeFirst();
    const ment = await this.db
      .selectFrom('prompt')
      .where('design_id', '=', designId)
      .select('ment')
      .executeTakeFirst();
    const result = await this.generatePhoto(
      originalPhoto.photo_id,
      originalPhoto.url,
      designId,
      ment.ment,
      1,
    );

    if (result) {
      const photoResult = await this.db
        .selectFrom('photo_results')
        .where('id', '=', result.id)
        .selectAll()
        .executeTakeFirst();
      const resultUrl = await this.db
        .selectFrom('upload_file')
        .where('id', '=', photoResult.result_image_id)
        .selectAll()
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
        item: {
          id: result.id,
          url: resultUrl.url,
          designId: designId,
        },
      };
    }
  }
  /*
애저에 올리기 
*/
  async uploadToAzure(base64: string) {
    return await this.azureBlobService.uploadFileImageBase64(base64);
  }

  async insertIntoPhoto(
    originalPhotoId: number,
    hairDesignId: number,
    resultImageId?: string,
  ) {
    const before = await this.db
      .selectFrom('photo_results')
      .where('original_photo_id', '=', originalPhotoId)
      .where('hair_design_id', '=', hairDesignId)
      .select('id')
      .executeTakeFirst();
    if (before) {
      if (resultImageId) {
        await this.db
          .updateTable('photo_results')
          .set({
            created_at: new Date(),
            result_image_id: resultImageId,
            status: resultImageId ? 'complete' : 'fail',
          })
          .where('original_photo_id', '=', originalPhotoId)
          .where('hair_design_id', '=', hairDesignId)
          .output(['inserted.id'])
          .executeTakeFirst();
      }
      return before;
    }
    return await this.db
      .insertInto('photo_results')
      .values({
        original_photo_id: originalPhotoId,
        hair_design_id: hairDesignId,
        created_at: new Date(),
        result_image_id: resultImageId,
        status: resultImageId ? 'complete' : 'fail',
      })
      .output(['inserted.id'])
      .executeTakeFirst();
  }
  /*
  사진 하나 만을기
   */
  async generatePhoto(
    photoId: number,
    photoUrl: string,
    designId: number,
    ment: string,
    retry: number,
  ) {
    try {
      for (let i = 0; i <= retry; i++) {
        const image = await this.geminiService.generatePhoto(photoUrl, ment);
        if (image) {
          const upload_file = await this.uploadToAzure(image);
          if (upload_file) {
            return await this.insertIntoPhoto(
              photoId,
              designId,
              upload_file.id,
            );
          }
          break;
        }
      }
    } catch (e) {}
  }
}
