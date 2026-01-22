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
import { Image } from 'src/libs/types';
@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly aiService: AiService,
    private readonly kakaoService: KakaoService,
    private readonly messageService: MessageService,
    private readonly photoRepository: PhotoRepository,
  ) {}

  async makeAllPhotos(
    originalPhotoId: number,
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
  ) {
    const MAX_RETRY = 3;
    let attempt = 0;

    // 2️⃣ 원본 사진 (+ payment_id, selected_design_id 포함)
    const originalPhoto = await this.db
      .selectFrom('photos as p')
      .innerJoin('upload_file as u', 'u.id', 'p.upload_file_id')
      .where('p.id', '=', originalPhotoId)
      .select([
        'p.id as photo_id',
        'u.url as url',
        'p.user_id as user_id',
        'p.payment_id as payment_id',
        'p.selected_design_id as selected_design_id',
      ])
      .executeTakeFirst();

    if (!originalPhoto) {
      throw new Error('원본 사진 없음');
    }

    const hasPayment = !!originalPhoto.payment_id;

    // ✅ 결제 없으면 selected_design_id 하나만 생성, 결제 있으면 1~16 생성
    const targetDesignIds = hasPayment
      ? Array.from({ length: 16 }, (_, i) => i + 1)
      : originalPhoto.selected_design_id
        ? [originalPhoto.selected_design_id]
        : [];

    // ✅ 결제 없는데 selected_design_id 없으면 아무 것도 안 만들고 종료(정책에 맞게)
    if (!hasPayment && targetDesignIds.length === 0) {
      await this.photoRepository.updatePhotoStatus(originalPhotoId, 'finished');
      return;
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

      // ✅ "우리가 만들기로 한 target"만 완료되었는지 체크
      const targetCompletedCount = targetDesignIds.filter((id) =>
        completedSet.has(id),
      ).length;

      if (targetCompletedCount === targetDesignIds.length) {
        if (hasPayment) {
          this.afterMakeAllPhoto(originalPhotoId);
        }
        return;
      }

      // 기존 로직 유지: 마지막 직전 시도면 break (원본 코드 흐름 그대로)
      if (attempt == MAX_RETRY - 1) {
        break;
      }

      // 4️⃣ 미완료 target design만 재요청
      for (const designId of targetDesignIds) {
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
            isDummy,
            forceFail,
            delaySecond,
            originalPhoto.selected_design_id,
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
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
    isPaid?: boolean,
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
      isDummy,
      forceFail,
      delaySecond,
      designId,
    );
    if (result) {
      await this.photoRepository.generateBeforeAfterThumbnail(photoId);
      if (isPaid) {
        await this.photoRepository.updatePhotoStatus(
          photoId,
          'rest_generating',
        );
        this.makeAllPhotos(photoId, isDummy, forceFail, delaySecond);
      } else {
        await this.photoRepository.updatePhotoStatus(photoId, 'complete');
      }
    } else {
      await this.photoRepository.updatePhotoStatus(photoId, 'finished');
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
    const _photo = await this.db
      .selectFrom('photos')
      .where('id', '=', photoId)
      .selectAll()
      .executeTakeFirst();
    if (_photo.status === 'complete') {
    } else {
      await this.photoRepository.updatePhotoStatus(photoId, 'complete');
      this.sendKakao(photoId);
    }
    this.photoRepository.generateWorldcupImage(photoId);
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

    // await this.kakaoService.sendKakaoNotification(
    //   user.user_id,
    //   'pr_cplt_hr_smln_v1', //확정 템플릿 추가
    //   null,
    //   [],
    //   [token, photoId.toString()],
    // );

    //pr_cplt_hr_smln_v1 템플릿에서 부가정보를 변경했고, 검수 통과되면 _v1에서 v2로 변경해주셔야 합니다 @꿀민섭
    await this.kakaoService.sendKakaoNotification(
      user.user_id,
      'pr_cplt_hr_smln_v2', //확정 템플릿 추가
      null,
      [],
      [token, photoId.toString()],
    );
  }

  /*
애저에 올리기 
*/
  async uploadToAzure(base64: string, toWebp = false) {
    return await this.azureBlobService.uploadFileImageBase64(base64, toWebp);
  }

  dummyPhoto: {
    id: string;
    // file_name: string;
    // url: string;
    // created_at: Date;
  }[][] = [
    [
      { id: '6824AAB7-C4C6-4305-925A-5246B430DEEE' },
      { id: 'D8DF18E0-DB42-4445-A146-CF8E440B157B' },
      { id: '6EC13174-A2C3-47F8-A5B6-3F803F2FB7BB' },
      { id: 'C86673F7-6895-470E-88F1-91833A5B4D0D' },
      { id: '7CDD8E12-6D06-4550-A665-8253A7075901' },
      { id: '8057D939-1A77-485A-B55E-8078E2633578' },
      { id: 'B98633AA-6F7E-4B3D-9994-B094207AE7C7' },
      { id: 'EB42229E-00DF-423F-9610-92FDE6C23F4F' },
      { id: '92175CDB-F6FB-438C-9590-6573CBA0650D' },
      { id: 'E0871B62-581E-4EC5-B82D-3C124A2D720E' },
      { id: '142AEE16-9E4E-4378-A164-9AD558D06595' },
      { id: 'A2D9F402-1A0B-4950-85F8-7EEC004A0603' },
      { id: '4BAA87D0-3275-4D71-8A19-450684C4F6AB' },
      { id: '2B20A750-EB7B-4482-BDD6-3779EE7F18B4' },
      { id: '9D38282A-C3DB-4195-B9CB-6BC9494844AE' },
      { id: 'B2CEFE9A-756C-4032-9965-06543DA24E5D' },
    ],
    [
      { id: '6824AAB7-C4C6-4305-925A-5246B430DEEE' },
      { id: 'D8DF18E0-DB42-4445-A146-CF8E440B157B' },
      { id: '6EC13174-A2C3-47F8-A5B6-3F803F2FB7BB' },
      { id: 'C86673F7-6895-470E-88F1-91833A5B4D0D' },
      { id: '7CDD8E12-6D06-4550-A665-8253A7075901' },
      { id: '8057D939-1A77-485A-B55E-8078E2633578' },
      { id: 'B98633AA-6F7E-4B3D-9994-B094207AE7C7' },
      { id: 'EB42229E-00DF-423F-9610-92FDE6C23F4F' },
      { id: '92175CDB-F6FB-438C-9590-6573CBA0650D' },
      { id: 'E0871B62-581E-4EC5-B82D-3C124A2D720E' },
      { id: '142AEE16-9E4E-4378-A164-9AD558D06595' },
      { id: 'A2D9F402-1A0B-4950-85F8-7EEC004A0603' },
      { id: '4BAA87D0-3275-4D71-8A19-450684C4F6AB' },
      { id: '2B20A750-EB7B-4482-BDD6-3779EE7F18B4' },
      { id: '9D38282A-C3DB-4195-B9CB-6BC9494844AE' },
      { id: 'B2CEFE9A-756C-4032-9965-06543DA24E5D' },
    ],
  ];
  async addPromptLog(photoId: number, desginId: number, prompt: string) {
    try {
      await this.db
        .insertInto('log_prompt')
        .values({
          photo_id: photoId,
          design_id: desginId,
          prompt: prompt,
          created_at: new Date(),
        })
        .execute();
    } catch (e) {}
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
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
    selectedDesignId?: number,
  ) {
    let keyRow: { id: number; key: string } | undefined;

    try {
      await this.photoRepository.updatePhotoTime(
        photoId,
        designId,
        selectedDesignId,
      );
      await this.photoRepository.updatePhotoResult(
        photoId,
        designId,
        null,
        'pending',
        tryCount,
      );

      if (isDummy === true) {
        const forTest = new Promise<{
          id: string;
        }>((resolve, reject) => {
          setTimeout(
            () => {
              for (let i = 0; i < 16; i++) {
                if (designId === i + 1) {
                  resolve(this.dummyPhoto[1][i]);
                }
              }
            },
            (delaySecond ?? 8) * 1000,
          );
        });

        const uploadFileTest = await forTest;
        await this.photoRepository.updatePhotoTime(
          photoId,
          designId,
          selectedDesignId,
        );
        return await this.photoRepository.updatePhotoResult(
          photoId,
          designId,
          uploadFileTest.id,
          'complete',
          tryCount,
        );
      }

      keyRow = await this.getGeminiKey();

      if (!keyRow) throw new Error('No available gemini_key');
      this.addPromptLog(photoId, designId, ment);

      const image = await this.aiService.generatePhotoGemini(
        photoUrl,
        null,
        ment,
        sampleUrl,
        keyRow.key,
        forceFail,
        delaySecond,
      );

      const uploadFile = await this.uploadToAzure(image, true);
      if (!uploadFile) {
        throw new InternalServerErrorException('Azure 업로드 실패');
      }
      await this.photoRepository.updatePhotoTime(
        photoId,
        designId,
        selectedDesignId,
      );
      return await this.photoRepository.updatePhotoResult(
        photoId,
        designId,
        uploadFile.id,
        'complete',
        tryCount,
      );
    } catch (e) {
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
      console.log('이미지 업로드 실패 :', photoId, designId, ment);
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
        if (code == 429) {
          if (keyRow?.id) {
            await this.db
              .updateTable('gemini_key')
              .set({ expired_at: new Date() })
              .where('id', '=', keyRow.id)
              .execute();
          }
        }
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

  async generatePhotoAdminTest(_image: Image, ment: string, ai: string) {
    if (ai == 'gemini') {
      let keyRow: { id: number; key: string } | undefined;
      try {
        keyRow = await this.getGeminiKey();

        if (!keyRow) throw new Error('No available gemini_key');
        const image = await this.aiService.generatePhotoGemini(
          _image.url,
          _image.data,
          ment,
          null,
          keyRow.key,
        );
        const uploadFile = await this.uploadToAzure(image, true);
        return uploadFile;
      } catch (e) {
        const err = normalizeError(e);
        const code = await this.extractGeminiErrorCode(err.message);
        if (code == 429) {
          if (keyRow?.id) {
            await this.db
              .updateTable('gemini_key')
              .set({ expired_at: new Date() })
              .where('id', '=', keyRow.id)
              .execute();
          }
        }
        throw new Error(`GeneratePhoto failed (code=${code}): ${err.message}`);
      }
    } else if (ai == 'seedream') {
      const image = await this.aiService.generatePhotoSeedream(
        null,
        _image.data,
        ment,
        null,
      );
      const uploadFile = await this.uploadToAzure(image);
      return uploadFile;
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
}
