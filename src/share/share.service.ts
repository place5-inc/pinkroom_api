import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoRepository } from 'src/photo/photo.repository';

@Injectable()
export class ShareService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoRepository: PhotoRepository,
  ) {}

  async getPhotoWithCode(code: string) {
    try {
      const code = await this.db
        .selectFrom('photo_share_code')
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
      return {
        status: HttpStatus.OK,
        result,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
