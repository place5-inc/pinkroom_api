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
  private readonly photoWorkerService = new PhotoWorkerService(
    this.db,
    this.azureBlobService,
    this.aiService,
    this.kakaoService,
    this.messageService,
    this.photoRepository,
  );
  @Cron('26 * * * *')
  public async check() {
    const startTime = new Date(Date.now() - 60 * 60 * 1000);

    const endTime = new Date(Date.now() - 2 * 60 * 1000);
    await this.messageService.sendSMSCertiCode('01054697884', 'test');
  }
}
