import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from 'src/ai/ai.service';
import { AzureBlobService } from 'src/azure/blob.service';
import { KakaoService } from 'src/kakao/kakao.service';
import { DatabaseProvider } from 'src/libs/db';
import { MessageService } from 'src/message/message.service';
import { PhotoWorkerService } from 'src/photo/photo-worker.service';
import { PhotoRepository } from 'src/photo/photo.repository';
import { ThumbnailService } from 'src/photo/thumbnail.service';

@Injectable()
export class CronService {
  private readonly db = new DatabaseProvider();
  private readonly messageService = new MessageService();
  private readonly azureBlobService = new AzureBlobService(this.db);
  private readonly aiService = new AiService();
  private readonly kakaoService = new KakaoService(this.db);
  private readonly thumbnailService = new ThumbnailService(
    this.azureBlobService,
  );
  private readonly photoRepository = new PhotoRepository(
    this.db,
    this.thumbnailService,
    this.azureBlobService,
  );
  private readonly workerService = new PhotoWorkerService(
    this.db,
    this.azureBlobService,
    this.aiService,
    this.kakaoService,
    this.messageService,
    this.photoRepository,
  );
  @Cron('5,35 * * * *')
  public async check() {
    const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const endTime = new Date(Date.now() - 2 * 60 * 1000);
    const list = await this.db
      .selectFrom('photo_results')
      .where('status', 'in', ['pending', 'fail'])
      .where('created_at', '>', endTime)
      .where('created_at', '<', startTime)
      .select('original_photo_id')
      .distinct()
      .execute();
    for (const item of list) {
      await this.messageService.sendSMSCertiCode(
        '01054697884',
        'cron retry:' + String(item.original_photo_id),
      );
      this.workerService.makeAllPhotos(item.original_photo_id);
    }
  }
}
