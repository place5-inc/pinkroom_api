import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseProvider } from 'src/libs/db';
import { MessageService } from 'src/message/message.service';
import { PhotoWorkerService } from 'src/photo/photo-worker.service';

@Injectable()
export class CronService {
  private readonly db = new DatabaseProvider();
  private readonly messageService = new MessageService();
  @Cron('5,35,45 * * * *')
  public async check() {
    const startTime = new Date(Date.now() - 60 * 60 * 1000);

    const endTime = new Date(Date.now() - 2 * 60 * 1000);
    await this.messageService.sendSMSCertiCode('01054697884', 'test');
    const list = await this.db
      .selectFrom('photo_results')
      .where('status', 'in', ['pending', 'fail'])
      .where('created_at', '<', endTime)
      .where('created_at', '>', startTime)
      .select('original_photo_id')
      .distinct()
      .execute();
    for (const item of list) {
      //   await this.messageService.sendSMSCertiCode(
      //     '01054697884',
      //     String(item.original_photo_id),
      //   );
      //this.workerService.makeAllPhotos(item.original_photo_id);
    }
  }
}
