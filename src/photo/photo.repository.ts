import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoVO } from 'src/libs/types';
@Injectable()
export class PhotoRepository {
  constructor(private readonly db: DatabaseProvider) {}

  async updatePhotoStatus(photoId: number, status: string) {
    await this.db
      .updateTable('photos')
      .set({
        status: status,
      })
      .where('id', '=', photoId)
      .execute();
  }
  async updatePhotoRetryCount(photoId: number, isPlus: boolean) {
    if (isPlus) {
      const photo = await this.db
        .selectFrom('photos')
        .where('id', '=', photoId)
        .selectAll()
        .executeTakeFirst();
      const count = photo.retry_count ?? 0;

      await this.db
        .updateTable('photos')
        .set({
          retry_count: count + 1,
        })
        .where('id', '=', photoId)
        .execute();
    } else {
      await this.db
        .updateTable('photos')
        .set({
          retry_count: 0,
        })
        .where('id', '=', photoId)
        .execute();
    }
  }
  async getPhotosByUserId(userId: string): Promise<PhotoVO[]> {
    const photos = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .leftJoin('upload_file as bf', 'bf.id', 'p.thumbnail_before_after_id')
      .leftJoin('upload_file as w', 'w.id', 'p.thumbnail_worldcup_id')
      .leftJoin('upload_file as mi', 'mi.id', 'p.merged_image_id')
      .where('p.user_id', '=', userId)
      .orderBy('p.id desc')
      .select([
        'p.id as photoId',
        'p.payment_id as paymentId',
        'p.code as code',
        'p.selected_design_id as selectedDesignId',
        'uf.url as sourceImageUrl',
        'bf.url as thumbnailBeforeAfterUrl',
        'w.url as thumbnailWorldcupUrl',
        'mi.url as mergedImageUrl',
        'p.created_at',
        'p.status as status',
        'p.retry_count as retry_count',
      ])
      .execute();

    const photoIds = photos.map((p) => p.photoId);

    if (photoIds.length === 0) {
      return [];
    }
    const photoResults = await this.db
      .selectFrom('photo_results as pr')
      .leftJoin('upload_file as uf', 'uf.id', 'pr.result_image_id')
      .where('pr.original_photo_id', 'in', photoIds)
      .select([
        'pr.id as resultId',
        'pr.original_photo_id as photoId',
        'pr.hair_design_id as designId',
        'pr.status',
        'pr.created_at',
        'pr.fail_code as failCode',
        'uf.url',
      ])
      .execute();

    return photos.map((p) => {
      return {
        id: p.photoId,
        paymentId: p.paymentId,
        code: p.code,
        selectedDesignId: p.selectedDesignId,
        sourceImageUrl: p.sourceImageUrl,
        thumbnailBeforeAfterUrl: p.thumbnailBeforeAfterUrl,
        thumbnailWorldcupUrl: p.thumbnailWorldcupUrl,
        mergedImageUrl: p.mergedImageUrl,
        createdAt: p.created_at.toISOString(),
        status: p.status,
        retryCount: p.retry_count,
        resultImages: photoResults
          .filter((r) => r.photoId === p.photoId)
          .map((r) => ({
            id: r.resultId,
            url: r.url,
            designId: r.designId,
            status: r.status,
            createdAt: r.created_at.toISOString(),
            failCode: r.failCode,
          })),
      };
    });
  }
  async getPhotoById(photoId: number): Promise<PhotoVO | null> {
    const photo = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .leftJoin('upload_file as bf', 'bf.id', 'p.thumbnail_before_after_id')
      .leftJoin('upload_file as w', 'w.id', 'p.thumbnail_worldcup_id')
      .leftJoin('upload_file as mi', 'mi.id', 'p.merged_image_id')
      .where('p.id', '=', photoId)
      .select([
        'p.id as photoId',
        'p.payment_id as paymentId',
        'p.code as code',
        'p.selected_design_id as selectedDesignId',
        'uf.url as sourceImageUrl',
        'bf.url as thumbnailBeforeAfterUrl',
        'w.url as thumbnailWorldcupUrl',
        'mi.url as mergedImageUrl',
        'p.created_at',
        'p.status as status',
        'p.retry_count as retry_count',
      ])
      .executeTakeFirst();

    if (!photo) return null;

    const photoResults = await this.db
      .selectFrom('photo_results as pr')
      .leftJoin('upload_file as uf', 'uf.id', 'pr.result_image_id')
      .where('pr.original_photo_id', '=', photoId)
      .select([
        'pr.id as resultId',
        'pr.original_photo_id as photoId',
        'pr.hair_design_id as designId',
        'pr.status',
        'pr.created_at',
        'pr.fail_code as failCode',
        'uf.url',
      ])
      .execute();

    return {
      id: photo.photoId,
      paymentId: photo.paymentId,
      code: photo.code,
      sourceImageUrl: photo.sourceImageUrl,
      thumbnailBeforeAfterUrl: photo.thumbnailBeforeAfterUrl,
      thumbnailWorldcupUrl: photo.thumbnailWorldcupUrl,
      mergedImageUrl: photo.mergedImageUrl,
      selectedDesignId: photo.selectedDesignId,
      createdAt: photo.created_at.toISOString(),
      status: photo.status,
      retryCount: photo.retry_count,
      resultImages: photoResults.map((r) => ({
        id: r.resultId,
        url: r.url,
        designId: r.designId,
        status: r.status,
        createdAt: r.created_at.toISOString(),
        failCode: r.failCode,
      })),
    };
  }
}
