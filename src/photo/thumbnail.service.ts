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
      const rootPath = process.cwd();
      // const fontPathBold = join(
      //   rootPath,
      //   'dist/resources/fonts/Pretendard-Bold.ttf',
      // );
      // const fontPathRegular = join(
      //   rootPath,
      //   'dist/resources/fonts/Pretendard-Regular.ttf',
      // );
      const path = require('path');
      // 1. 탐색할 후보 경로 리스트 (대소문자 주의!)
      const candidates = [
        path.join(rootPath, 'dist/resources/fonts/Pretendard-Bold.ttf'),
        path.join(rootPath, 'resources/fonts/Pretendard-Bold.ttf'),
        path.join(rootPath, 'wwwroot/dist/resources/fonts/Pretendard-Bold.ttf'),
        path.resolve(__dirname, '../../resources/fonts/Pretendard-Bold.ttf'),
        path.resolve(__dirname, '../resources/fonts/Pretendard-Bold.ttf'),
      ];
      console.log('[ThumbnailService] 폰트 탐색 시작...');

      //console.log('[ThumbnailService] 폰트 경로 확인:', fontPathBold);

      const fs = require('fs');
      // if (fs.existsSync(fontPathBold)) {
      //   // registerFont(fontPathBold, { family: 'PretendardBold' });
      //   // registerFont(fontPathRegular, { family: 'PretendardRegular' });
      //   registerFont(fontPathRegular, {
      //     family: 'Pretendard',
      //     weight: '400',
      //   });

      //   registerFont(fontPathBold, {
      //     family: 'Pretendard',
      //     weight: '700',
      //   });
      //   console.log(
      //     '[ThumbnailService] Pretendard 폰트 등록 완료 (PretendardBold, PretendardRegular)',
      //   );
      // } else {
      //   // 만약 dist에 없다면 루트의 resources라도 시도합니다.
      //   const fallbackPath = join(
      //     rootPath,
      //     'resources/fonts/Pretendard-Bold.ttf',
      //   );
      //   if (fs.existsSync(fallbackPath)) {
      //     registerFont(
      //       join(rootPath, 'resources/fonts/Pretendard-Regular.ttf'),
      //       { family: 'Pretendard', weight: '400' },
      //     );
      //     registerFont(fallbackPath, { family: 'Pretendard', weight: '700' });
      //     console.log('[Font Debug] Fonts registered from root resources.');
      //   } else {
      //     console.warn('[Font Debug] No font files found in dist or root.');
      //   }
      // }

      let foundBaseDir = null;

      for (const fullPath of candidates) {
        const exists = fs.existsSync(fullPath);
        console.log(
          `[Font Check] 경로 확인: ${fullPath} -> ${exists ? '✅ 있음' : '❌ 없음'}`,
        );

        if (exists) {
          foundBaseDir = path.dirname(fullPath);
          break;
        }
      }

      if (foundBaseDir) {
        const filesInDir = fs.readdirSync(foundBaseDir);
        console.log(
          `[Font Check] 🎯 폴더 내부 파일 목록: ${JSON.stringify(filesInDir)}`,
        );
        const regularPath = path.join(foundBaseDir, 'Pretendard-Regular.ttf');
        const boldPath = path.join(foundBaseDir, 'Pretendard-Bold.ttf');

        registerFont(regularPath, { family: 'Pretendard', weight: '400' });
        registerFont(boldPath, { family: 'Pretendard', weight: '700' });

        console.log(
          `[ThumbnailService] 🎯 최종 폰트 등록 완료! 위치: ${foundBaseDir}`,
        );
      } else {
        console.error(
          '[ThumbnailService] 😱 경고: 모든 경로에서 폰트 파일을 찾지 못했습니다.',
        );
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

    // Load images
    const [imgBefore, imgAfter] = await Promise.all([
      this.loadImageFromUrl(beforeUrl),
      this.loadImageFromUrl(afterUrl),
    ]);
    //주석추가

    // Left Half (Before)
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

    // Right Half (After)
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

    // Draw Badges
    // 폰트 설정: 개별 등록한 PretendardBold를 우선 사용합니다.
    ctx.font = '700 20px "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const badgeW = 84;
    const badgeH = 32;
    const margin = 12; // 사용자 요청 마진
    const badgeY = margin;

    // Before Badge (Left Half - Top Left)
    const leftBadgeX = margin;
    ctx.fillStyle = 'rgba(128, 128, 128, 1.0)';
    this.drawRoundedRect(ctx, leftBadgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Before', leftBadgeX + badgeW / 2, badgeY + badgeH / 2);

    // After Badge (Right Half - Top Left)
    const rightBadgeX = width / 2 + margin;
    ctx.fillStyle = '#E9407A';
    this.drawRoundedRect(ctx, rightBadgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('After', rightBadgeX + badgeW / 2, badgeY + badgeH / 2);

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
            return await this.loadImageFromUrl(url);
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
      ctx.font = '700 15px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PINK ROOM', width / 2, currentY + labelHeight / 2);

      // 타이틀
      currentY += labelHeight + titleMarginTop;

      const lines = ['저에게 가장 잘 어울리는', '헤어스타일을 골라주세요!'];

      const fontSize = 27;
      const lineHeight = Math.round(fontSize * 1.4);

      ctx.fillStyle = '#444444';
      ctx.font = '700 27px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.save();
      ctx.scale(0.96, 1);

      lines.forEach((line, i) => {
        const y = currentY + i * lineHeight;

        const x = width / 2 / 0.96; // scale 보정
        ctx.fillText(line, x, y);
        ctx.fillText(line, x + 0.4, y);
        ctx.fillText(line, x, y + 0.4);
      });

      ctx.restore();

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
        this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
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
        this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, cellRadius);
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
  private async generateWorldcupThumbnailCanvas(
    imageUrls: string[],
  ): Promise<Buffer | null> {
    const width = 300;
    const height = 150;
    const scale = 2;

    const paddingX = 18;
    const paddingTop = 16;
    const titleFontSize = 12;
    const titleLineHeight = 1.2;
    const gapBetweenTitleAndGrid = 12;

    const gridRowGap = 5;
    const gridColGap = 5;
    const cols = 4;
    const rowAspect = 166 / 200;
    const bottomGradientHeight = 44;
    const cellRadius = 4;

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

      /** 이미지 로딩 */
      const urls = imageUrls.slice(0, 8);
      const images = await Promise.all(
        urls.map(async (url) => {
          try {
            return await this.loadImageFromUrl(url);
          } catch {
            return null;
          }
        }),
      );

      /** 배경 그라데이션 */
      const bgGradient = ctx.createLinearGradient(0, 0, width, height * 3);
      bgGradient.addColorStop(0.202, '#F8DBE7');
      bgGradient.addColorStop(1, '#D31154');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      /** 타이틀 */
      let currentY = paddingTop;
      ctx.fillStyle = '#e9407a';
      ctx.font = '700 12px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('내 친구의 BEST 헤어스타일은?', width / 2, currentY - 2);

      currentY += titleFontSize * titleLineHeight + gapBetweenTitleAndGrid;

      /** 4x2 그리드 */
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          const index = row * 4 + col;
          const img = images[index];

          const x = paddingX + col * (cellWidth + gridColGap);
          const y = currentY + row * (cellHeight + gridRowGap);

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

      /** 하단 그라데이션 */
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
