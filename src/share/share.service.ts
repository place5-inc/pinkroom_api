import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { generateCode } from 'src/libs/helpers';
import { PhotoRepository } from 'src/photo/photo.repository';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image } from 'src/libs/types';

@Injectable()
export class ShareService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoRepository: PhotoRepository,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async getPhotoWithCode(_code: string) {
    try {
      const code = await this.db
        .selectFrom('photo_share_code')
        .where('code', '=', _code)
        .selectAll()
        .executeTakeFirst();

      if (!code) {
        // 코드 없음
        throw new HttpException(
          '존재하지 않는 코드입니다.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 현재 시간과 비교
      const now = new Date();
      if (code.expired_at && now > code.expired_at) {
        throw new HttpException('만료된 코드입니다.', HttpStatus.FORBIDDEN);
      }
      const result = await this.photoRepository.getPhotoById(code.photo_id);
      const photo = await this.db
        .selectFrom('photos')
        .where('id', '=', code.photo_id)
        .select('user_id')
        .executeTakeFirst();

      const user = await this.db
        .selectFrom('users')
        .where('id', '=', photo.user_id)
        .selectAll()
        .executeTakeFirst();
      return {
        status: HttpStatus.OK,
        result,
        user,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async makePhotoCode(userId: string, photoId: number, type: string) {
    try {
      const photo = await this.db
        .selectFrom('photos')
        .where('id', '=', photoId)
        .where('user_id', '=', userId)
        //.where('payment_id','is not',null)
        .selectAll()
        .executeTakeFirst();

      if (!photo) {
        throw new HttpException(
          '존재하지 않는 사진입니다.',
          HttpStatus.NOT_FOUND,
        );
      }
      let code: string;
      let exists = true;

      while (exists) {
        code = await generateCode();

        const found = await this.db
          .selectFrom('photo_share_code')
          .select('id')
          .where('code', '=', code)
          .executeTakeFirst();

        exists = !!found;
      }
      const now = new Date();
      const expireTime = new Date(now.getTime() + 3 * 24 * 60 * 60000);

      await this.db
        .insertInto('photo_share_code')
        .values({
          photo_id: photo.id,
          created_at: now,
          expired_at: expireTime, // 3일 후
          code: code,
          code_type: type,
        })
        .execute();

      return {
        status: HttpStatus.OK,
        code: code,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async uploadThumbnailPhoto(photoId: number, image: Image) {
    try {
      const prevPhoto = await this.db
        .selectFrom('photo_thumbnails')
        .where('photo_id', '=', photoId)
        .selectAll()
        .executeTakeFirst();
      if (prevPhoto) {
        throw new HttpException(
          '이미 썸네일이 있습니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const uploadedFile = await this.azureBlobService.uploadFileImage(image);
      if (uploadedFile) {
        await this.db
          .insertInto('photo_thumbnails')
          .values({
            photo_id: photoId,
            upload_file_id: uploadedFile?.id ?? null,
            created_at: new Date(),
          })
          .executeTakeFirst();
      }
      return {
        status: HttpStatus.OK,
        result: {
          id: uploadedFile?.id,
          url: uploadedFile?.url,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async getThumbnailPhoto(photoId: number) {
    try {
      const photo = await this.db
        .selectFrom('photo_thumbnails')
        .leftJoin(
          'upload_file',
          'upload_file.id',
          'photo_thumbnails.upload_file_id',
        )
        .where('photo_id', '=', photoId)
        .select([
          'photo_thumbnails.id as id',
          'photo_thumbnails.upload_file_id as upload_file_id',
          'upload_file.url as url',
        ])
        .executeTakeFirst();

      if (!photo) {
        throw new HttpException(
          '썸네일이 존재하지 않습니다.',
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        status: HttpStatus.OK,
        result: {
          id: photo.upload_file_id,
          url: photo.url,
        },
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
