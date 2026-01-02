import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GeminiService } from 'src/ai/gemini.service';
import { AzureBlobService } from 'src/azure/blob.service';
import { DatabaseProvider } from 'src/libs/db';
import { KakaoService } from 'src/kakao/kakao.service';
import { sql } from 'kysely';
import { generateCode, normalizeError } from 'src/libs/helpers';
import { WorldcupService } from 'src/worldcup/worldcup.service';
@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly geminiService: GeminiService,
    private readonly kakaoService: KakaoService,
    private readonly worldcupService: WorldcupService,
  ) {}

  async makeAllPhotos(originalPhotoId: number) {
    const MAX_RETRY = 5;
    let attempt = 0;
    // 2️⃣ 원본 사진
    const originalPhoto = await this.db
      .selectFrom('photos as p')
      .innerJoin('upload_file as u', 'u.id', 'p.upload_file_id')
      .where('p.id', '=', originalPhotoId)
      .select(['p.id as photo_id', 'u.url as url'])
      .executeTakeFirst();

    if (!originalPhoto) {
      throw new Error('원본 사진 없음');
    }

    // 3️⃣ 프롬프트
    const prompts = await this.db
      .selectFrom('prompt')
      .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
      .select([
        'prompt.design_id as designId',
        'prompt.ment',
        'upload_file.url as imageUrl',
      ])
      .execute();
    const totalCount = await this.db
      .selectFrom('prompt')
      .select(sql<number>`count(*)`.as('count'))
      .executeTakeFirst();

    while (attempt < MAX_RETRY) {
      attempt++;

      // 1️⃣ 완료된 것 조회
      const completed = await this.db
        .selectFrom('photo_results')
        .where('original_photo_id', '=', originalPhotoId)
        .where('status', '=', 'complete')
        .select('hair_design_id')
        .execute();

      const completedSet = new Set(completed.map((r) => r.hair_design_id));

      if (completedSet.size === totalCount.count) {
        console.log(`🎉 ${attempt}번째 시도에서 전부 완료`);
        const user = await this.db
          .selectFrom('photos')
          .where('id', '=', originalPhotoId)
          .select('user_id')
          .executeTakeFirst();
        if (!user) {
          return;
        }
        await this.worldcupService.addWorldCupLog(
          originalPhotoId,
          user.user_id,
        );
        this.sendKakao(originalPhotoId, user.user_id);
        return;
      }

      // 4️⃣ 미완료 design만 재요청
      for (let designId = 1; designId <= 16; designId++) {
        if (completedSet.has(designId)) continue;

        const prompt = prompts.find((m) => m.designId === designId);
        if (!prompt) continue;

        try {
          await this.generatePhoto(
            originalPhotoId,
            originalPhoto.url,
            designId,
            prompt.ment,
            prompt.imageUrl,
          );
        } catch (e) {
          console.error(`❌ design ${designId} 실패 (attempt ${attempt})`, e);
        }
      }

      // 5️⃣ 외부 API 반영 시간 대비 약간 대기
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.error('🚨 최대 재시도 초과, 일부 실패');
  }

  async sendKakao(photoId: number, userId: string) {
    //todo kakaoRepo 호출

    let token: string;
    let exists = true;

    while (exists) {
      token = await generateCode(12);

      const found = await this.db
        .selectFrom('token')
        .select('id')
        .where('token', '=', token)
        .executeTakeFirst();

      exists = !!found;
    }
    const now = new Date();
    const expireTime = new Date(now.getTime() + 24 * 60 * 60000);

    await this.db
      .insertInto('token')
      .values({
        user_id: userId,
        token,
        created_at: now,
        expired_at: expireTime,
      })
      .executeTakeFirst();

    await this.kakaoService.sendKakaoNotification(
      userId,
      'pr_cplt_hr_smln_test', //테스트용 템플릿 임시 추가
      null,
      [],
      [token, photoId.toString()],
    );
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
    sampleUrl?: string,
  ) {
    try {
      const image = await this.geminiService.generatePhoto(
        photoUrl,
        ment,
        sampleUrl,
      );

      const uploadFile = await this.uploadToAzure(image);
      if (!uploadFile) {
        throw new InternalServerErrorException('Azure 업로드 실패');
      }

      return await this.insertIntoPhoto(photoId, designId, uploadFile.id);
    } catch (e) {
      const err = normalizeError(e);
      await this.insertIntoPhoto(photoId, designId, null);
      await this.db
        .insertInto('log_gemini_error')
        .values({
          created_at: new Date(),
          photo_id: photoId,
          design_id: designId,
          error: err.message,
        })
        .execute();
    }
  }
}
