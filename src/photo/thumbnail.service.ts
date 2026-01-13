import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { join, resolve } from 'path';
import { AzureBlobService } from 'src/azure/blob.service';
import axios from 'axios';
import sharp = require('sharp');
@Injectable()
export class ThumbnailService implements OnModuleInit {
  constructor(private readonly azureBlobService: AzureBlobService) {}
  onModuleInit() {
    try {
      const path = require('path');
      const rootPath = process.cwd(); // /home/site/wwwroot

      // API 결과로 확인된 확실한 경로
      const fontDir = path.join(rootPath, 'dist/resources/fonts');

      const regularPath = path.join(fontDir, 'Pretendard-Regular.ttf');
      const boldPath = path.join(fontDir, 'Pretendard-Bold.ttf');

      const fs = require('fs');
      if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
        // 폰트 등록 (family 이름을 하나로 통일하고 weight로 구분하는 것이 표준입니다)
        registerFont(regularPath, { family: 'Pretendard', weight: '400' });
        registerFont(boldPath, { family: 'Pretendard', weight: '700' });

        console.log('[ThumbnailService] 폰트 등록 완료: Pretendard (400, 700)');
      } else {
        console.error('[ThumbnailService] 폰트 파일을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('[ThumbnailService] 폰트 등록 중 예외 발생:', error);
    }
  }
  async loadImageFromUrl(url: string) {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Image fetch failed: status=${res.status} url=${url}`);
    }

    const input = Buffer.from(res.data);
    const contentType = String(res.headers['content-type'] || '').toLowerCase();

    // webp(및 향후 avif/heic 등) 대응: canvas에 넣기 전에 표준 포맷으로 정규화
    const needTranscode =
      contentType.includes('image/webp') ||
      contentType.includes('image/avif') ||
      contentType.includes('image/heic') ||
      contentType.includes('image/heif');

    if (!needTranscode) {
      // jpeg/png면 바로 시도
      try {
        return await loadImage(input);
      } catch {
        // content-type이 거짓말이거나 깨진 경우 대비: 변환으로 한번 더 시도
      }
    }

    const normalized = await sharp(input).png().toBuffer(); // 또는 .jpeg()
    return await loadImage(normalized);
  }
  /**
   * Generates a composite image (Before/After) for sharing
   */
  async generateBeforeAfter(
    beforeUrl: string,
    afterUrl: string,
  ): Promise<Buffer> {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 1. 이미지 로딩
    const [imgBefore, imgAfter, tagBefore, tagAfter] = await Promise.all([
      this.loadImageFromUrl(beforeUrl),
      this.loadImageFromUrl(afterUrl),
      this.loadImageFromUrl(
        'https://pinkroom.blob.core.windows.net/pinkroom/before_tag.png',
      ),
      this.loadImageFromUrl(
        'https://pinkroom.blob.core.windows.net/pinkroom/after_tag.png',
      ),
    ]);

    // 2. Left Half (Before Photo)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width / 2, height);
    ctx.clip();
    const ratio1 = Math.max(
      width / 2 / imgBefore.width,
      height / imgBefore.height,
    );
    const w1 = imgBefore.width * ratio1;
    const h1 = imgBefore.height * ratio1;
    ctx.drawImage(imgBefore, (width / 2 - w1) / 2, (height - h1) / 2, w1, h1);
    ctx.restore();

    // 3. Right Half (After Photo)
    ctx.save();
    ctx.beginPath();
    ctx.rect(width / 2, 0, width / 2, height);
    ctx.clip();
    const ratio2 = Math.max(
      width / 2 / imgAfter.width,
      height / imgAfter.height,
    );
    const w2 = imgAfter.width * ratio2;
    const h2 = imgAfter.height * ratio2;
    ctx.drawImage(
      imgAfter,
      width / 2 + (width / 2 - w2) / 2,
      (height - h2) / 2,
      w2,
      h2,
    );
    ctx.restore();

    // 4. 태그 이미지 설정
    const margin = 12;
    const badgeY = margin;

    // 기본 높이는 둘 다 동일하게 유지
    const badgeH = 32;

    // Before 태그 가로 폭 (기존 유지)
    const beforeW = 84;

    // After 태그 가로 폭 (198/249 비율로 축소)
    // 84 * (198/249) = 약 66.8
    const afterW = beforeW * (198 / 249);

    // Before Tag 그리기
    if (tagBefore) {
      ctx.drawImage(tagBefore, margin, badgeY, beforeW, badgeH);
    }

    // After Tag 그리기 (높이는 같고 가로만 축소됨)
    if (tagAfter) {
      const rightBadgeX = width / 2 + margin;
      // 가로 폭에 afterW 적용
      ctx.drawImage(tagAfter, rightBadgeX, badgeY, afterW, badgeH);
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.9 });
  }

  async generateMergedWorldcupImage(imageUrls: string[]) {
    const MAX_RETRY = 2;
    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        // 2. 캔버스 생성 및 이미지 병합
        const mergedImageBuffer = await this.generateMergedCanvas(imageUrls);

        if (!mergedImageBuffer) {
          throw new Error('Canvas generation failed');
        }
        return mergedImageBuffer;
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
  }
  async generateWorldcupThumbnail(imageUrls: string[]) {
    const MAX_RETRY = 2;
    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        // 2. 캔버스 생성 및 이미지 병합
        const thumbnailBuffer =
          await this.generateWorldcupThumbnailCanvas(imageUrls);

        if (!thumbnailBuffer) {
          throw new Error('Canvas generation failed');
        }
        return thumbnailBuffer;
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
  }
  // 캔버스 드로잉 로직 분리
  private async generateMergedCanvas(
    imageUrls: string[],
  ): Promise<Buffer | null> {
    // 1. 기본 논리 사이즈 설정 (사용자 제공 수치)
    const width = 800;
    const height = 1330;
    const bannerHeight = 352;
    const gridAreaHeight = 978; // 1330 - 352

    const scale = 2; // 고해상도 출력을 위한 배율
    const cols = 4;
    const rows = 4;

    // 2. 그리드 간격 및 패딩 설정
    const paddingX = 22; // 좌우 여백
    const gridTopMargin = 0; // 배너와 그리드 사이 간격
    const gap = 11; // 이미지 사이 간격
    const cellRadius = 14; // 이미지 모서리 둥글게

    // 3. 셀 크기 자동 계산
    const gridWidth = width - paddingX * 2;
    const cellWidth = (gridWidth - gap * (cols - 1)) / cols;
    // 4:5 혹은 제공된 비율(0.83)에 맞게 높이 설정 (여기선 영역에 맞춰 자동 배분)
    const cellHeight =
      (gridAreaHeight - gridTopMargin - gap * (rows - 1) - 70) / rows;

    try {
      // 캔버스 생성 (고해상도 적용)
      const canvas = createCanvas(width * scale, height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // 이미지들 병렬 로딩
      const [loadedImages, bannerImage] = await Promise.all([
        Promise.all(
          imageUrls
            .slice(0, 16)
            .map((url) => this.loadImageFromUrl(url).catch(() => null)),
        ),
        this.loadImageFromUrl(
          'https://pinkroom.blob.core.windows.net/pinkroom/merged_top.png',
        ),
      ]);

      // 배경색 (흰색)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 4. 상단 배너 이미지 그리기 (800x352)
      if (bannerImage) {
        ctx.drawImage(bannerImage, 0, 0, width, bannerHeight);
      }

      // 5. 그리드 시작 위치 설정
      const gridStartY = bannerHeight + gridTopMargin;

      // 6. 16개 이미지 배치
      for (let index = 0; index < 16; index++) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = paddingX + col * (cellWidth + gap);
        const y = gridStartY + row * (cellHeight + gap);

        // 셀 배경 (이미지 로딩 실패 시 노출)
        ctx.fillStyle = '#f8f8f8';
        this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
        ctx.fill();

        const img = loadedImages[index];
        if (!img) continue;

        // 이미지 Cover Fit 계산
        const imgRatio = img.width / img.height;
        const cellRatio = cellWidth / cellHeight;
        let drawWidth, drawHeight, offsetX, offsetY;

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
        this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
        ctx.clip();
        ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
        ctx.restore();
      }

      // 최종 결과물 출력
      return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (e) {
      console.error('[generateMergedCanvas] Error:', e);
      return null;
    }
  }
  private async generateWorldcupThumbnailCanvas(
    imageUrls: string[],
  ): Promise<Buffer | null> {
    const width = 300;
    const height = 150;
    const scale = 2;

    const paddingX = 18;
    const paddingTop = 0; // 배너 시작 위치 (약간 조정)
    const bannerHeight = 36; // 상단 배너(글자 포함) 이미지의 고정 높이 설정
    const gapBetweenTitleAndGrid = 7; // 배너와 그리드 사이 간격 축소

    const gridRowGap = 5;
    const gridColGap = 5;
    const cols = 4;
    const rowAspect = 166 / 200;
    const bottomGradientHeight = 44;
    const cellRadius = 4;

    // 그리드 너비와 셀 크기 계산
    const gridWidth = width - paddingX * 2;
    const cellWidth = (gridWidth - gridColGap * (cols - 1)) / cols;
    const cellHeight = cellWidth / rowAspect;

    try {
      const canvas = createCanvas(
        Math.round(width * scale),
        Math.round(height * scale),
      );
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      /** 1. 이미지 및 배너 로딩 병렬 처리 */
      const urls = imageUrls.slice(0, 8);
      const [images, bannerImage] = await Promise.all([
        Promise.all(
          urls.map((url) => this.loadImageFromUrl(url).catch(() => null)),
        ),
        this.loadImageFromUrl(
          'https://pinkroom.blob.core.windows.net/pinkroom/merged_top_2.png',
        ),
      ]);

      /** 2. 배경 그라데이션 */
      const bgGradient = ctx.createLinearGradient(0, 0, width, height * 3);
      bgGradient.addColorStop(0.202, '#F8DBE7');
      bgGradient.addColorStop(1, '#D31154');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      /** 3. 상단 타이틀 배너 그리기 (텍스트 fillText 대체) */
      let currentY = paddingTop;
      let finalBannerHeight = 36; // 폴백용 기본값
      if (bannerImage) {
        // 비율 계산: 원본 너비 대비 높이 비율을 구함
        const aspectRatio = bannerImage.width / bannerImage.height;
        // 캔버스 너비(300)에 맞춘 실제 높이 계산 (글자 찌그러짐 방지)
        finalBannerHeight = width / aspectRatio;

        ctx.drawImage(bannerImage, 0, currentY, width, finalBannerHeight);
      }

      // 그리드 시작 위치 계산 (배너 높이 + 간격)
      currentY += bannerHeight + gapBetweenTitleAndGrid;

      /** 4. 4x2 그리드 그리기 */
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          const index = row * 4 + col;
          const img = images[index];

          const x = paddingX + col * (cellWidth + gridColGap);
          const y = currentY + row * (cellHeight + gridRowGap);

          // 이미지 베이스 (로딩 실패 대비)
          ctx.fillStyle = '#F3F4F6';
          this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
          ctx.fill();

          if (!img) continue;

          ctx.save();
          this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
          ctx.clip();
          this.drawImageCover(ctx, img, x, y, cellWidth, cellHeight);
          ctx.restore();
        }
      }

      /** 5. 하단 그라데이션 */
      const bottomGradient = ctx.createLinearGradient(
        0,
        height - bottomGradientHeight,
        0,
        height,
      );
      bottomGradient.addColorStop(0, 'rgba(235,144,177,0)');
      bottomGradient.addColorStop(1, '#EB90B1');
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(
        0,
        height - bottomGradientHeight,
        width,
        bottomGradientHeight,
      );

      return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (e) {
      console.error('[generateWorldcupThumbnailCanvas]', e);
      return null;
    }
  }

  private drawImageCover(
    ctx: any,
    img: any,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;

    let sx: number, sy: number, sw: number, sh: number;

    if (imgRatio > targetRatio) {
      sh = img.height;
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / targetRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  private drawRoundedRect(
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
}
