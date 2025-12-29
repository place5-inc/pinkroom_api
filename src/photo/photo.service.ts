import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image, PhotoVO } from 'src/libs/types';
import { PhotoWorkerService } from './photo-worker.service';
import { PhotoRepository } from './photo.repository';
import { sql } from 'kysely';
@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly workerService: PhotoWorkerService,
    private readonly photoRepository: PhotoRepository,
  ) {}

  async getPhotoList(userId: string) {
    try {
      const results = await this.photoRepository.getPhotosByUserId(userId);
      return {
        status: HttpStatus.OK,
        results,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async getResultPhotoList(photoId: number) {
    try {
      const result = await this.photoRepository.getPhotoById(photoId);
      return {
        status: HttpStatus.OK,
        result,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  /* 
  유저가 사진 업로드
  */
  async uploadPhoto(
    userId: string,
    image: Image,
    designId: number,
    paymentId?: number,
    _code?: string,
  ) {
    try {
      if (!paymentId && !_code) {
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
      if (_code) {
        const code = await this.db
          .selectFrom('photo_share_code')
          .where('code', '=', _code)
          .selectAll()
          .executeTakeFirst();
        if (!code) {
          throw new NotFoundException('결제를 찾을 수 없습니다.');
        }
        if (code.expired_at < new Date()) {
          throw new BadRequestException('이미 만료된 코드입니다.');
        }
        const codePhoto = await this.db
          .selectFrom('photos')
          .where('id', '=', code.photo_id)
          .selectAll()
          .executeTakeFirst();
        if (!codePhoto) {
          throw new NotFoundException('코드의 사진 정보를 찾을 수 없습니다.');
        }
        if (!codePhoto.payment_id) {
          throw new BadRequestException(
            '공유된 코드는 무료 체험이 가능한 코드가 아닙니다.',
          );
        }

        const row = await this.db
          .selectFrom('users')
          .where('use_code_photo_id', '=', code.photo_id)
          .select(sql<number>`count(*)`.as('count'))
          .executeTakeFirst();

        const useCount = row?.count ?? 0;
        if (useCount > 15) {
          throw new ForbiddenException('코드 사용 가능 횟수를 초과했습니다.');
        }
        const user = await this.db
          .selectFrom('users')
          .where('id', '=', userId)
          .selectAll()
          .executeTakeFirst();
        if (!user) {
          throw new NotFoundException('유저 정보를 찾을 수 없습니다.');
        }
        if (user.use_code_photo_id != null) {
          throw new BadRequestException('이미 사용한 코드가 있습니다.');
        }
        await this.db
          .updateTable('users')
          .where('id', '=', userId)
          .set({
            use_code_id: _code,
            use_code_photo_id: code.photo_id,
          })
          .execute();
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

      const prompt = await this.db
        .selectFrom('prompt')
        .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
        .where('prompt.design_id', '=', designId)
        .select([
          'prompt.design_id as designId',
          'prompt.ment',
          'upload_file.url as imageUrl',
        ])
        .executeTakeFirst();
      if (!prompt) {
        throw new NotFoundException('prompt를 찾을 수 없습니다.');
      }
      const result = await this.workerService.generatePhoto(
        photo.id,
        uploadedFile.url,
        designId,
        prompt.ment,
        prompt.imageUrl,
        5,
      );
      if (result) {
        const item = this.photoRepository.getPhotoById(photo.id);

        if (paymentId) {
          this.workerService.makeAllPhotos(photo.id);
        }

        return {
          status: HttpStatus.OK,
          result: item,
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
    const prompt = await this.db
      .selectFrom('prompt')
      .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
      .where('prompt.design_id', '=', designId)
      .select([
        'prompt.design_id as designId',
        'prompt.ment',
        'upload_file.url as imageUrl',
      ])
      .executeTakeFirst();
    const result = await this.workerService.generatePhoto(
      originalPhoto.photo_id,
      originalPhoto.url,
      designId,
      prompt.ment,
      prompt.imageUrl,
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
}
