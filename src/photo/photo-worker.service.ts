import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { AzureBlobService } from 'src/azure/blob.service';
import { DatabaseProvider } from 'src/libs/db';
import { KakaoService } from 'src/kakao/kakao.service';
import { sql } from 'kysely';
import { generateCode, normalizeError } from 'src/libs/helpers';
import { ThumbnailService } from './thumbnail.service';
import { MessageService } from 'src/message/message.service';
import { PhotoService } from './photo.service';
import { PhotoRepository } from './photo.repository';
import { createCanvas, loadImage, registerFont } from 'canvas';
@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly aiService: AiService,
    private readonly kakaoService: KakaoService,
    private readonly thumbnailService: ThumbnailService,
    private readonly messageService: MessageService,
    private readonly photoService: PhotoService,
    private readonly photoRepository: PhotoRepository,
  ) {}

  async makeAllPhotos(originalPhotoId: number): Promise<string | null> {
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
        const mergedImageUrl = this.afterMakeAllPHoto(originalPhotoId);
        if (mergedImageUrl) {
          return mergedImageUrl;
        }
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
  async afterMakeAllPHoto(photoId: number): Promise<string | null> {
    this.sendKakao(photoId);
    this.generateWorldcupThumbnail(photoId);
    const mergedImageUrl = await this.makeMergeWorldCupShareImage(photoId);
    if (mergedImageUrl) {
      return mergedImageUrl;
    }
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

  //TODO 꿀배포 현진
  async generateWorldcupThumbnail(photoId: number) {
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
          await this.thumbnailService.generateWorldcup(imageUrls);
        /* 꿀배포 

        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(thumbnailBase64);

        if (thumbnailUpload) {
          await this.db
            .updateTable('photos')
            .set({ thumbnail_worldcup_id: thumbnailUpload.id })
            .where('id', '=', photoId)
            .execute();
          console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
        */
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
  async makeMergeWorldCupShareImage(photoId: number): Promise<string | null> {
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
    // 이미지가 16개가 안되면 생성 불가 처리 혹은 예외 처리
    if (imageUrls.length < 16) {
      console.warn(`[MergeImage] Not enough images for photoId: ${photoId}`);
      return null;
    }

    const MAX_RETRY = 2;
    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        // 2. 캔버스 생성 및 이미지 병합
        const mergedImageBuffer = await this.generateMergedCanvas(imageUrls);

        if (!mergedImageBuffer) {
          throw new Error('Canvas generation failed');
        }

        // 3. Azure 업로드를 위한 Base64 변환
        const base64String = `data:image/jpeg;base64,${mergedImageBuffer.toString('base64')}`;

        // 4. Azure Blob Storage 업로드
        const uploadResult = await this.azureBlobService.uploadFileImageBase64(
          base64String,
          false,
        ); // webp 변환 필요시 true

        if (uploadResult) {
          return uploadResult.url;
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 월드컵 공유 이미지 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_RETRY - 1) {
          console.error('[PhotoService] 월드컵 공유 이미지 최종 생성 실패');
        }
      }
    }
    return null;
  }

  // 캔버스 드로잉 로직 분리
  private async generateMergedCanvas(
    imageUrls: string[],
  ): Promise<Buffer | null> {
    const width = 440;
    const scale = 2;
    const cols = 4;
    const rows = 4;
    const gap = 6;
    const paddingX = 12;
    const paddingY = 40;
    const labelWidth = 105;
    const labelHeight = 30;
    const labelMarginTop = 0;
    const titleMarginTop = 16;
    const titleFontSize = 28;
    const titleLineHeight = 38;
    const gridMarginTop = 32;
    const cellRadius = 8;

    // 셀 크기 계산
    const gridWidth = width - paddingX * 2;
    const cellWidth = (gridWidth - gap * (cols - 1)) / cols;
    const cellHeight = (cellWidth / 83) * 100;
    const gridHeight = cellHeight * rows + gap * (rows - 1);

    const titleBlockHeight = titleLineHeight * 2;
    const totalHeight =
      paddingY +
      labelMarginTop +
      labelHeight +
      titleMarginTop +
      titleBlockHeight +
      gridMarginTop +
      gridHeight +
      paddingY;

    try {
      const canvas = createCanvas(
        Math.round(width * scale),
        Math.round(totalHeight * scale),
      );
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // 이미지 병렬 로딩
      const targetUrls = imageUrls.slice(0, cols * rows);
      const loadedImages = await Promise.all(
        targetUrls.map(async (url) => {
          try {
            return await loadImage(url);
          } catch (e) {
            return null; // 로드 실패 시 빈 칸 처리
          }
        }),
      );

      // 배경
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, totalHeight);

      // 상단 라벨 (Pink Label)
      const labelX = (width - labelWidth) / 2;
      let currentY = paddingY + labelMarginTop;

      ctx.fillStyle = '#e9407a';
      ctx.fillRect(labelX, currentY, labelWidth, labelHeight);

      ctx.fillStyle = '#ffffff';
      // 폰트 폴백 설정 (Pretendard -> Apple SD -> System)
      ctx.font = `800 15px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PINK ROOM', width / 2, currentY + labelHeight / 2);

      // 타이틀
      currentY += labelHeight + titleMarginTop;
      ctx.fillStyle = '#444444';
      ctx.font = `800 ${titleFontSize}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('저에게 가장 잘 어울리는', width / 2, currentY);
      ctx.fillText(
        '헤어스타일을 골라주세요!',
        width / 2,
        currentY + titleLineHeight,
      );

      // 그리드 그리기
      const gridStartY = currentY + titleBlockHeight + gridMarginTop;
      const cellRatio = 83 / 100;

      for (let index = 0; index < cols * rows; index += 1) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = paddingX + col * (cellWidth + gap);
        const y = gridStartY + row * (cellHeight + gap);

        // 셀 배경 (이미지 없을 경우 보임)
        ctx.fillStyle = '#f8f8f8';
        this.drawRoundedRectPath(ctx, x, y, cellWidth, cellHeight, cellRadius);
        ctx.fill();

        const img = loadedImages[index];
        if (!img) continue;

        // Cover fit 계산
        const imgRatio = (img.width as number) / (img.height as number);
        let drawWidth: number;
        let drawHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (imgRatio > cellRatio) {
          drawHeight = cellHeight;
          drawWidth = cellHeight * imgRatio;
          offsetX = (cellWidth - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = cellWidth;
          drawHeight = cellWidth / imgRatio;
          offsetX = 0;
          offsetY = (cellHeight - drawHeight) / 2;
        }

        ctx.save();
        this.drawRoundedRectPath(ctx, x, y, cellWidth, cellHeight, cellRadius);
        ctx.clip();
        ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
        ctx.restore();
      }

      return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (e) {
      console.error('[generateMergedCanvas] Error:', e);
      return null;
    }
  }

  // 헬퍼 함수: 둥근 사각형 그리기
  private drawRoundedRectPath(
    ctx: any,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /*
애저에 올리기 
*/
  async uploadToAzure(base64: string, toWebp = false) {
    return await this.azureBlobService.uploadFileImageBase64(base64, toWebp);
  }

  async insertIntoPhoto(
    originalPhotoId: number,
    hairDesignId: number,
    resultImageId?: string,
    status?: string,
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
      await this.insertIntoPhoto(photoId, designId, null, 'waiting');
      const image = await this.aiService.generatePhotoGemini(
        photoUrl,
        null,
        ment,
        sampleUrl,
      );

      const uploadFile = await this.uploadToAzure(image, true);
      if (!uploadFile) {
        throw new InternalServerErrorException('Azure 업로드 실패');
      }

      return await this.insertIntoPhoto(
        photoId,
        designId,
        uploadFile.id,
        'complete',
      );
    } catch (e) {
      const err = normalizeError(e);
      await this.insertIntoPhoto(photoId, designId, null, 'fail');
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
    }
  }

  async generatePhotoAdminTest(base64: string, ment: string, ai: string) {
    if (ai == 'gemini') {
      const image = await this.aiService.generatePhotoGemini(
        null,
        base64,
        ment,
        null,
      );
      const uploadFile = await this.uploadToAzure(image, true);
      return uploadFile.url;
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
}
