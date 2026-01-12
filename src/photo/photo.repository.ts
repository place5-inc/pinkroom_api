import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoVO } from 'src/libs/types';
@Injectable()
export class PhotoRepository {
  constructor(private readonly db: DatabaseProvider) {}
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
    const ONE_MINUTE = 60 * 1000;
    const REQUIRED_COUNT = 16;
    const now = Date.now();
    const completedCountByPhotoId = new Map<number, number>();

    for (const r of photoResults) {
      const isCompletedResult =
        r.status !== 'waiting' ||
        (r.status === 'waiting' && now - r.created_at.getTime() >= ONE_MINUTE);

      if (!isCompletedResult) continue;

      completedCountByPhotoId.set(
        r.photoId,
        (completedCountByPhotoId.get(r.photoId) ?? 0) + 1,
      );
    }

    return photos.map((p) => {
      const completedCount = completedCountByPhotoId.get(p.photoId) ?? 0;

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
        isCompleted: completedCount === REQUIRED_COUNT,
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
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000;

    const completedCount = photoResults.filter((r) => {
      if (r.status !== 'waiting') {
        return true;
      }

      // waiting 인 경우, 1분 이상 지났는지
      return now - r.created_at.getTime() >= ONE_MINUTE;
    }).length;
    const REQUIRED_COUNT = 16;
    const isCompleted = completedCount === REQUIRED_COUNT;
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
      isCompleted,
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
