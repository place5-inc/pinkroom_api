import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { randomUUID } from 'crypto';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image } from 'src/libs/types';
@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
  ) {}
  async uploadPhoto(userId: string, image: Image) {
    try {
      const uploadedFile = await this.azureBlobService.uploadFileImage(image);
      await this.db.insertInto('photos').values({
        user_id: userId,
        upload_file_id: uploadedFile?.id ?? null,
        created_at: new Date(),
      });
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async createUser(phone: string) {
    const id = randomUUID();
    await this.db
      .insertInto('users')
      .values({
        id,
        phone,
        created_at: new Date(),
      })
      .executeTakeFirst();

    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }
}
