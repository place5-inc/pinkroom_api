import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoResultStatus, PhotoStatus, PhotoVO } from 'src/libs/types';
@Injectable()
export class PhotoRepository {
  constructor(private readonly db: DatabaseProvider) {}

  async updatePhotoStatus(photoId: number, status: PhotoStatus) {
    await this.db
      .updateTable('photos')
      .set({
        status: status,
        updated_at: new Date(),
      })
      .where('id', '=', photoId)
      .execute();
  }

  async updatePhotoStatuses(photoIds: number[], status: PhotoStatus) {
    if (photoIds.length === 0) return;

    await this.db
      .updateTable('photos')
      .set({ status: status, updated_at: new Date() })
      .where('id', 'in', photoIds)
      .execute();
  }
  async updatePhotoRetryCount(photoId: number, retryCount?: number) {
    if (retryCount)
      await this.db
        .updateTable('photos')
        .set({
          retry_count: retryCount,
        })
        .where('id', '=', photoId)
        .execute();
  }
  async updatePhotoResult(
    originalPhotoId: number,
    hairDesignId: number,
    resultImageId?: string,
    status?: PhotoResultStatus,
    tryCount?: number,
    code?: string,
  ) {
    const before = await this.db
      .selectFrom('photo_results')
      .where('original_photo_id', '=', originalPhotoId)
      .where('hair_design_id', '=', hairDesignId)
      .select('id')
      .executeTakeFirst();
    if (before) {
      const setValues: Record<string, any> = {
        created_at: new Date(),
      };

      if (resultImageId !== undefined)
        setValues.result_image_id = resultImageId;
      if (status !== undefined) setValues.status = status;
      if (tryCount !== undefined) setValues.try_count = tryCount;
      if (code !== undefined) setValues.fail_code = code;
      await this.db
        .updateTable('photo_results')
        .set(setValues)
        .where('original_photo_id', '=', originalPhotoId)
        .where('hair_design_id', '=', hairDesignId)
        .executeTakeFirst();

      return before;
    }
    return await this.db
      .insertInto('photo_results')
      .values({
        original_photo_id: originalPhotoId,
        hair_design_id: hairDesignId,
        created_at: new Date(),
        result_image_id: resultImageId,
        status: status,
        try_count: tryCount,
        fail_code: code,
      })
      .output(['inserted.id'])
      .executeTakeFirst();
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
        'p.did_show_complete_popup as didShowCompletePopup',
        'p.did_show_free_complete_popup as didShowFreeCompletePopup',
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
        didShowCompletePopup: p.didShowCompletePopup ?? false,
        didShowFreeCompletePopup: p.didShowFreeCompletePopup ?? false,
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
        'p.did_show_complete_popup as didShowCompletePopup',
        'p.did_show_free_complete_popup as didShowFreeCompletePopup',
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
      didShowCompletePopup: photo.didShowCompletePopup ?? false,
      didShowFreeCompletePopup: photo.didShowFreeCompletePopup ?? false,
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

  async updateCompletePopupShown(photoId: number) {
    await this.db
      .updateTable('photos')
      .set({
        did_show_complete_popup: true,
      })
      .where('id', '=', photoId)
      .execute();
  }

  async updateFreeCompletePopupShown(photoId: number) {
    await this.db
      .updateTable('photos')
      .set({
        did_show_free_complete_popup: true,
      })
      .where('id', '=', photoId)
      .execute();
  }
}
