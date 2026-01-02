import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { join } from 'path';

@Injectable()
export class ThumbnailService implements OnModuleInit {
    onModuleInit() {
        try {
            const fontPathBold = join(process.cwd(), 'resources', 'fonts', 'Pretendard-Bold.woff2');
            const fontPathRegular = join(process.cwd(), 'resources', 'fonts', 'Pretendard-Regular.woff2');

            console.log('[ThumbnailService] 폰트 경로 확인:', fontPathBold);

            // canvas 라이브러리는 woff2를 직접 지원하지 않을 수 있으므로, 
            // 만약 렌더링이 안된다면 나중에 .ttf로 교체해야 할 수도 있습니다.
            registerFont(fontPathBold, { family: 'Pretendard', weight: 'bold' });
            registerFont(fontPathRegular, { family: 'Pretendard', weight: 'normal' });

            console.log('[ThumbnailService] 폰트 등록 시도 완료 (Pretendard)');
        } catch (error) {
            console.error('[ThumbnailService] 폰트 등록 중 예외 발생:', error);
        }
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
            loadImage(beforeUrl),
            loadImage(afterUrl),
        ]);

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
        ctx.drawImage(imgAfter, width / 2 + (width / 2 - w2) / 2, (height - h2) / 2, w2, h2);
        ctx.restore();

        // Draw Badges
        ctx.font = 'bold 20px Pretendard, sans-serif';
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
