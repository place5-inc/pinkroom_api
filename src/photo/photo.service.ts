import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image, PhotoVO } from 'src/libs/types';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PhotoWorkerService } from './photo-worker.service';
@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly workerService: PhotoWorkerService,
  ) {}

  async getPhotoList(userId: string) {
    try {
      const results = await this.getPhotosByUserId(userId);
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
      const result = await this.getPhotoById(photoId);
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
      const result = await this.workerService.generatePhoto(
        photo.id,
        uploadedFile.url,
        designId,
        ment.ment,
        5,
      );
      if (result) {
        const item = this.getPhotoById(photo.id);

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
    const ment = await this.db
      .selectFrom('prompt')
      .where('design_id', '=', designId)
      .select('ment')
      .executeTakeFirst();
    const result = await this.workerService.generatePhoto(
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
  async getPhotosByUserId(userId: string): Promise<PhotoVO[]> {
    const photos = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .where('p.user_id', '=', userId)
      .select([
        'p.id as photoId',
        'p.payment_id as paymentId',
        'uf.url as sourceImageUrl',
        'p.created_at',
      ])
      .execute();

    const photoIds = photos.map((p) => p.photoId);

    const photoResults = await this.db
      .selectFrom('photo_results as pr')
      .leftJoin('upload_file as uf', 'uf.id', 'pr.result_image_id')
      .where('pr.original_photo_id', 'in', photoIds)
      .select([
        'pr.id as resultId',
        'pr.original_photo_id as photoId',
        'pr.hair_design_id as designId',
        'pr.status',
        'uf.url',
      ])
      .execute();

    // 매핑
    return photos.map((p) => ({
      id: p.photoId,
      paymentId: p.paymentId,
      sourceImageUrl: p.sourceImageUrl,
      createdAt: p.created_at.toISOString(),
      resultImages: photoResults
        .filter((r) => r.photoId === p.photoId)
        .map((r) => ({
          id: r.resultId,
          url: r.url,
          designId: r.designId,
          status: r.status,
        })),
    }));
  }
  async getPhotoById(photoId: number): Promise<PhotoVO | null> {
    const photo = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .where('p.id', '=', photoId)
      .select([
        'p.id as photoId',
        'p.payment_id as paymentId',
        'uf.url as sourceImageUrl',
        'p.created_at',
      ])
      .executeTakeFirst();

    if (!photo) return null;

    const photoResults = await this.db
      .selectFrom('photo_results as pr')
      .leftJoin('upload_file as uf', 'uf.id', 'pr.result_image_id')
      .where('pr.original_photo_id', '=', photoId)
      .select([
        'pr.id as resultId',
        'pr.hair_design_id as designId',
        'pr.status',
        'uf.url',
      ])
      .execute();

    return {
      id: photo.photoId,
      paymentId: photo.paymentId,
      sourceImageUrl: photo.sourceImageUrl,
      createdAt: photo.created_at.toISOString(),
      resultImages: photoResults.map((r) => ({
        id: r.resultId,
        url: r.url,
        designId: r.designId,
        status: r.status,
      })),
    };
  }
}
