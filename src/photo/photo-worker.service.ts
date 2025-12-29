import { Injectable } from '@nestjs/common';
import { GeminiService } from 'src/ai/gemini.service';
import { AzureBlobService } from 'src/azure/blob.service';
import { DatabaseProvider } from 'src/libs/db';

@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly geminiService: GeminiService,
  ) {}

  async makeAllPhotos(originalPhotoId: number) {
    const completed = await this.db
      .selectFrom('photo_results')
      .where('original_photo_id', '=', originalPhotoId)
      .where('status', '=', 'complete')
      .select('hair_design_id')
      .execute();
    const completedSet = new Set(completed.map((r) => r.hair_design_id));
    if (completedSet.size === 16) {
      console.log('이미 전부 완료됨');
      return;
    }
    const originalPhoto = await this.db
      .selectFrom('photos as p')
      .innerJoin('upload_file as u', 'u.id', 'p.upload_file_id')
      .where('p.id', '=', originalPhotoId)
      .select(['p.id as photo_id', 'u.url as url'])
      .executeTakeFirst();
    const ments = await this.db
      .selectFrom('prompt')
      .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
      .select([
        'prompt.design_id as designId',
        'prompt.ment',
        'upload_file.url as imageUrl',
      ])
      .execute();
    for (let designId = 1; designId <= 16; designId++) {
      if (completedSet.has(designId)) continue;
      const prompt = ments.find(
        (m) => m.designId === designId, // 또는 m.id === designId
      );
      if (!prompt) {
        continue;
      }

      await this.generatePhoto(
        originalPhotoId,
        originalPhoto.url,
        designId,
        prompt.ment,
        prompt.imageUrl,
        1,
      );
    }
  }
  async checkMakeAll() {}

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
    sampleUrl?: string,
    retry: number = 1,
  ) {
    try {
      for (let i = 0; i <= retry; i++) {
        const image = await this.geminiService.generatePhoto(
          photoUrl,
          ment,
          sampleUrl,
        );
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
