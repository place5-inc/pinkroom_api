import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { AzureBlobService } from 'src/azure/blob.service';
import { DatabaseProvider } from 'src/libs/db';
import { KakaoService } from 'src/kakao/kakao.service';
import { sql } from 'kysely';
import { generateCode, normalizeError } from 'src/libs/helpers';
import { ThumbnailService } from './thumbnail.service';
import { MessageService } from 'src/message/message.service';
import { PhotoRepository } from './photo.repository';
import { PhotoResultStatus } from 'src/libs/types';
@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly aiService: AiService,
    private readonly kakaoService: KakaoService,
    private readonly thumbnailService: ThumbnailService,
    private readonly messageService: MessageService,
    private readonly photoRepository: PhotoRepository,
  ) {}

  async makeAllPhotos(originalPhotoId: number) {
    const MAX_RETRY = 3;
    let attempt = 0;
    // 2️⃣ 원본 사진
    const originalPhoto = await this.db
      .selectFrom('photos as p')
      .innerJoin('upload_file as u', 'u.id', 'p.upload_file_id')
      .where('p.id', '=', originalPhotoId)
      .select(['p.id as photo_id', 'u.url as url', 'p.user_id as user_id'])
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
        this.afterMakeAllPhoto(originalPhotoId);
        return;
      }
      if (attempt == MAX_RETRY - 1) {
        break;
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
            attempt,
          );
        } catch (e) {
          console.error(`❌ design ${designId} 실패 (attempt ${attempt})`, e);
        }
      }

      // 5️⃣ 외부 API 반영 시간 대비 약간 대기
      await new Promise((r) => setTimeout(r, 2000));
    }

    await this.photoRepository.updatePhotoStatus(originalPhotoId, 'finished');
    this.failMakePhoto(originalPhoto.user_id, 'all');
  }
  async makeOnlyOne(
    photoId: number,
    photoUrl: string,
    designId: number,
    tryCount?: number,
  ) {
    await this.photoRepository.updatePhotoStatus(photoId, 'first_generating');
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
      return;
    }
    const result = await this.generatePhoto(
      photoId,
      photoUrl,
      designId,
      prompt.ment,
      prompt.imageUrl,
      tryCount,
    );
    if (result) {
      await this.generateBeforeAfterThumbnail(photoId);

      return {
        result,
      };
    }
  }
  async failMakePhoto(userId: string, type: string) {
    //first, all
    if (!userId) {
      return;
    }
    //꿀배포 실패시 알림톡 쏘기
    if (type === 'first') {
      await this.kakaoService.sendKakaoNotification(
        userId,
        'pr_fail_pt_rst',
        null,
        [],
        [],
      );
      // await this.kakaoService.sendKakaoNotification(
      //   userId,
      //   'test_02',
      //   null,
      //   ['첫번째 사진에 오류가 발생했어요'],
      //   [],
      // );
    } else if (type === 'all') {
      await this.kakaoService.sendKakaoNotification(
        userId,
        'pr_fail_pt_rst',
        null,
        [],
        [],
      );
      // await this.kakaoService.sendKakaoNotification(
      //   userId,
      //   'test_02',
      //   null,
      //   ['완성되지 못한 사진이 있어요'],
      //   [],
      // );
    }
  }

  async afterMakeAllPhoto(photoId: number) {
    await this.photoRepository.updatePhotoStatus(photoId, 'complete');
    this.sendKakao(photoId);
    this.generateWorldcupImage(photoId);
  }

  async sendKakao(photoId: number) {
    //todo kakaoRepo 호출
    const user = await this.db
      .selectFrom('photos')
      .where('id', '=', photoId)
      .select('user_id')
      .executeTakeFirst();
    if (!user) {
      return;
    }
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
        user_id: user.user_id,
        token,
        created_at: now,
        expired_at: expireTime,
      })
      .executeTakeFirst();

    await this.kakaoService.sendKakaoNotification(
      user.user_id,
      'pr_cplt_hr_smln_v1', //확정 템플릿 추가
      null,
      [],
      [token, photoId.toString()],
    );
  }

  async generateWorldcupImage(photoId: number) {
    const photos = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .select(['uf.url as url'])
      .execute();
    const imageUrls = photos
      .map((r) => r.url)
      .filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      );
    const MAX_MERGED_IMAGE_RETRY = 2;
    for (let i = 0; i < MAX_MERGED_IMAGE_RETRY; i++) {
      try {
        const mergedImageBuffer =
          await this.thumbnailService.generateMergedWorldcupImage(imageUrls);
        if (!mergedImageBuffer) {
          throw new Error('Thumbnail buffer is empty (generated failed)');
        }
        const mergedImageBase64 = `data:image/jpeg;base64,${mergedImageBuffer.toString(
          'base64',
        )}`;
        const mergedImageUpload =
          await this.azureBlobService.uploadFileImageBase64(
            mergedImageBase64,
            false,
            true,
          );

        if (mergedImageUpload) {
          await this.db
            .updateTable('photos')
            .set({ merged_image_id: mergedImageUpload.id })
            .where('id', '=', photoId)
            .execute();
          //console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_MERGED_IMAGE_RETRY - 1) {
          console.error(
            '[PhotoService] Worldcup merged image generation failed',
          );
        }
      }
    }
    const MAX_THUMBNAIL_RETRY = 2;
    for (let i = 0; i < MAX_THUMBNAIL_RETRY; i++) {
      try {
        const thumbnailBuffer =
          await this.thumbnailService.generateWorldcupThumbnail(imageUrls);
        if (!thumbnailBuffer) {
          throw new Error('Thumbnail buffer is empty (generated failed)');
        }
        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(
            thumbnailBase64,
            false,
            true,
          );

        if (thumbnailUpload) {
          await this.db
            .updateTable('photos')
            .set({ thumbnail_worldcup_id: thumbnailUpload.id })
            .where('id', '=', photoId)
            .execute();
          //console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_THUMBNAIL_RETRY - 1) {
          console.error('[PhotoService] Worldcup thumbnail generation failed');
        }
      }
    }
  }
  async generateWorldcupMergedImageFontTest(photoId: number): Promise<string> {
    let url: string = '';
    const photos = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .select(['uf.url as url'])
      .execute();
    const imageUrls = photos
      .map((r) => r.url)
      .filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      );
    const MAX_MERGED_IMAGE_RETRY = 2;
    for (let i = 0; i < MAX_MERGED_IMAGE_RETRY; i++) {
      try {
        const mergedImageBuffer =
          await this.thumbnailService.generateMergedWorldcupImageFontTest(
            imageUrls,
          );
        if (!mergedImageBuffer) {
          throw new Error('Thumbnail buffer is empty (generated failed)');
        }
        const mergedImageBase64 = `data:image/jpeg;base64,${mergedImageBuffer.toString(
          'base64',
        )}`;
        const mergedImageUpload =
          await this.azureBlobService.uploadFileImageBase64(
            mergedImageBase64,
            false,
            true,
          );

        if (mergedImageUpload) {
          url = mergedImageUpload.url;
          // await this.db
          //   .updateTable('photos')
          //   .set({ merged_image_id: mergedImageUpload.id })
          //   .where('id', '=', photoId)
          //   .execute();
          //console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_MERGED_IMAGE_RETRY - 1) {
          console.error(
            '[PhotoService] Worldcup merged image generation failed',
          );
        }
      }
    }
    return url;
  }
  async generateWorldcupThumbnailImageFontTest(
    photoId: number,
  ): Promise<string> {
    let url: string = '';
    const photos = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .select(['uf.url as url'])
      .execute();
    const imageUrls = photos
      .map((r) => r.url)
      .filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      );
    const MAX_THUMBNAIL_RETRY = 2;
    for (let i = 0; i < MAX_THUMBNAIL_RETRY; i++) {
      try {
        const thumbnailBuffer =
          await this.thumbnailService.generateWorldcupThumbnailFontTest(
            imageUrls,
          );
        if (!thumbnailBuffer) {
          throw new Error('Thumbnail buffer is empty (generated failed)');
        }
        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(
            thumbnailBase64,
            false,
            true,
          );

        if (thumbnailUpload) {
          url = thumbnailUpload.url;
          // await this.db
          //   .updateTable('photos')
          //   .set({ thumbnail_worldcup_id: thumbnailUpload.id })
          //   .where('id', '=', photoId)
          //   .execute();
          //console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_THUMBNAIL_RETRY - 1) {
          console.error('[PhotoService] Worldcup thumbnail generation failed');
        }
      }
    }
    return url;
  }

  /*
애저에 올리기 
*/
  async uploadToAzure(base64: string, toWebp = false) {
    return await this.azureBlobService.uploadFileImageBase64(base64, toWebp);
  }

  /*
  사진 만들기
   */
  async generatePhoto(
    photoId: number,
    photoUrl: string,
    designId: number,
    ment: string,
    sampleUrl?: string,
    tryCount?: number,
  ) {
    let keyRow: { id: number; key: string } | undefined;

    try {
      await this.photoRepository.updatePhotoResult(
        photoId,
        designId,
        null,
        'pending',
        tryCount,
      );

      keyRow = await this.getGeminiKey();

      if (!keyRow) throw new Error('No available gemini_key');

      const image = await this.aiService.generatePhotoGemini(
        photoUrl,
        null,
        ment,
        sampleUrl,
        keyRow.key,
      );

      const uploadFile = await this.uploadToAzure(image, true);
      if (!uploadFile) {
        throw new InternalServerErrorException('Azure 업로드 실패');
      }

      return await this.photoRepository.updatePhotoResult(
        photoId,
        designId,
        uploadFile.id,
        'complete',
        tryCount,
      );
    } catch (e) {
      if (keyRow?.id) {
        await this.db
          .updateTable('gemini_key')
          .set({ expired_at: new Date() })
          .where('id', '=', keyRow.id)
          .execute();
      }
      const err = normalizeError(e);

      await this.db
        .insertInto('log_gemini_error')
        .values({
          created_at: new Date(),
          photo_id: photoId,
          design_id: designId,
          error: err.message,
        })
        .execute();

      //TODO 에러일때 문자쏘기
      const ment = await this.extractGeminiErrorMessage(err.message);
      this.messageService.sendErrorToManager(ment ?? '사진 생성 에러');
      await this.photoRepository.updatePhotoResult(
        photoId,
        designId,
        null,
        'fail',
        tryCount,
      );
      try {
        const code = await this.extractGeminiErrorCode(err.message);
        await this.photoRepository.updatePhotoResult(
          photoId,
          designId,
          null,
          'fail',
          tryCount,
          code,
        );
      } catch (e2) {
        await this.db
          .insertInto('log_gemini_error')
          .values({
            created_at: new Date(),
            photo_id: photoId,
            design_id: designId,
            error: 'error code 파싱 에러',
          })
          .execute();
      }
    }
  }

  async generatePhotoAdminTest(base64: string, ment: string, ai: string) {
    if (ai == 'gemini') {
      let keyRow: { id: number; key: string } | undefined;
      try {
        keyRow = await this.getGeminiKey();

        if (!keyRow) throw new Error('No available gemini_key');
        const image = await this.aiService.generatePhotoGemini(
          null,
          base64,
          ment,
          null,
          keyRow.key,
        );
        const uploadFile = await this.uploadToAzure(image, true);
        return uploadFile.url;
      } catch (e) {
        if (keyRow?.id) {
          await this.db
            .updateTable('gemini_key')
            .set({ expired_at: new Date() })
            .where('id', '=', keyRow.id)
            .execute();
        }
      }
    } else if (ai == 'seedream') {
      const image = await this.aiService.generatePhotoSeedream(
        null,
        base64,
        ment,
        null,
      );
      const uploadFile = await this.uploadToAzure(image);
      return uploadFile.url;
    }
  }

  async extractGeminiErrorMessage(err: unknown) {
    // 1) err가 문자열(JSON)인 경우
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err);
        return parsed?.error?.message ?? err;
      } catch {
        return err;
      }
    }

    // 2) err가 객체인 경우 (ApiError 등)
    if (err && typeof err === 'object') {
      const anyErr = err as any;

      // 이미 error.message 형태로 들어있는 경우
      const direct = anyErr?.error?.message;
      if (typeof direct === 'string') return direct;

      // Gemini SDK ApiError의 message가 JSON 문자열인 경우가 많음
      if (typeof anyErr?.message === 'string') {
        const msg = anyErr.message;
        try {
          const parsed = JSON.parse(msg);
          return parsed?.error?.message ?? msg;
        } catch {
          return msg;
        }
      }
    }

    return 'Unknown error';
  }

  async extractGeminiErrorCode(err: unknown) {
    // 1) err가 문자열(JSON)인 경우
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err);
        return parsed?.error?.code ?? err;
      } catch {
        return err;
      }
    }

    // 2) err가 객체인 경우 (ApiError 등)
    if (err && typeof err === 'object') {
      const anyErr = err as any;

      // 이미 error.message 형태로 들어있는 경우
      const direct = anyErr?.error?.code;
      if (typeof direct === 'string') return direct;

      // Gemini SDK ApiError의 message가 JSON 문자열인 경우가 많음
      if (typeof anyErr?.code === 'string') {
        const msg = anyErr.code;
        try {
          const parsed = JSON.parse(msg);
          return parsed?.error?.code ?? msg;
        } catch {
          return msg;
        }
      }
    }

    return 'Unknown error';
  }

  async getGeminiKey() {
    const lastResetUtc = sql`
(
  (
    CASE
      WHEN CONVERT(time, SYSDATETIMEOFFSET() AT TIME ZONE 'Korea Standard Time') < '17:00:00'
        THEN DATEADD(day, -1, DATEADD(hour, 17, CONVERT(datetime2, CONVERT(date, SYSDATETIMEOFFSET() AT TIME ZONE 'Korea Standard Time'))))
      ELSE DATEADD(hour, 17, CONVERT(datetime2, CONVERT(date, SYSDATETIMEOFFSET() AT TIME ZONE 'Korea Standard Time')))
    END
  ) AT TIME ZONE 'Korea Standard Time'
) AT TIME ZONE 'UTC'
`;

    const q = this.db
      .selectFrom('gemini_key')
      .where(
        sql<boolean>`
    expired_at IS NULL
    OR expired_at < ${lastResetUtc}
  `,
      )
      .orderBy('id')
      .select(['id', 'key']);

    let keyRow = await q.executeTakeFirst();
    if (!keyRow) {
      keyRow = await this.db
        .selectFrom('gemini_key')
        .orderBy('id')
        .select(['id', 'key'])
        .executeTakeFirst();
    }
    return keyRow;
  }
  /*
  썸네일 before After 만들기
   */
  async generateBeforeAfterThumbnail(photoId: number) {
    const photo = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .where('p.id', '=', photoId)
      .select([
        'p.id as photoId',
        'p.thumbnail_before_after_id as thumbnail_before_after_id',
        'p.selected_design_id as selected_design_id',
        'uf.url as beforeUrl',
      ])
      .executeTakeFirst();
    if (!photo) {
      return;
    }
    const after = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .where('hair_design_id', '=', photo.selected_design_id)
      .select(['uf.url as afterUrl'])
      .executeTakeFirst();

    const MAX_THUMBNAIL_RETRY = 2;
    for (let i = 0; i < MAX_THUMBNAIL_RETRY; i++) {
      try {
        const thumbnailBuffer = await this.thumbnailService.generateBeforeAfter(
          photo.beforeUrl,
          after.afterUrl,
        );

        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(
            thumbnailBase64,
            false,
            true,
          );

        if (thumbnailUpload) {
          await this.db
            .updateTable('photos')
            .set({ thumbnail_before_after_id: thumbnailUpload.id })
            .where('id', '=', photoId)
            .execute();
          console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_THUMBNAIL_RETRY - 1) {
          console.error('[PhotoService] 썸네일 최종 생성 실패');
        }
      }
    }
  }
  async generateBeforeAfterThumbnailFontTest(photoId: number): Promise<string> {
    let url: string = '';
    const photo = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .where('p.id', '=', photoId)
      .select([
        'p.id as photoId',
        'p.thumbnail_before_after_id as thumbnail_before_after_id',
        'p.selected_design_id as selected_design_id',
        'uf.url as beforeUrl',
      ])
      .executeTakeFirst();
    if (!photo) {
      return '';
    }
    const after = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .where('hair_design_id', '=', photo.selected_design_id)
      .select(['uf.url as afterUrl'])
      .executeTakeFirst();

    const MAX_THUMBNAIL_RETRY = 2;
    for (let i = 0; i < MAX_THUMBNAIL_RETRY; i++) {
      try {
        const thumbnailBuffer =
          await this.thumbnailService.generateBeforeAfterFontTest(
            photo.beforeUrl,
            after.afterUrl,
          );

        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(thumbnailBase64);

        if (thumbnailUpload) {
          url = thumbnailUpload.url;
          // await this.db
          //   .updateTable('photos')
          //   .set({ thumbnail_before_after_id: thumbnailUpload.id })
          //   .where('id', '=', photoId)
          //   .execute();
          console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_THUMBNAIL_RETRY - 1) {
          console.error('[PhotoService] 썸네일 최종 생성 실패');
        }
      }
    }
    return url;
  }
}
