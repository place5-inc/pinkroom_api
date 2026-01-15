import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { generateCode } from 'src/libs/helpers';
import { PhotoRepository } from 'src/photo/photo.repository';
import { getRandomName } from 'src/libs/helpers';
import { sql } from 'kysely';
import { UserRepository } from 'src/user/user.repository';

@Injectable()
export class ShareService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoRepository: PhotoRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getPhotoWithCode(_code: string) {
    try {
      let canUseFree = false;
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

      const user = await this.userRepository.getUser(photo.user_id);

      const codePhoto = await this.db
        .selectFrom('photos')
        .where('id', '=', code.photo_id)
        .selectAll()
        .executeTakeFirst();
      if (codePhoto.payment_id) {
        canUseFree = true;
      }

      const row = await this.db
        .selectFrom('users')
        .where('use_code_photo_id', '=', code.photo_id)
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirst();

      const useCount = row?.count ?? 0;

      const limit = Number(process.env.CODE_SHARE_LIMIT ?? 0);
      if (useCount >= limit) {
        canUseFree = false;
      }
      return {
        status: HttpStatus.OK,
        result,
        user,
        canUseFree,
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;

      throw new InternalServerErrorException(e?.message ?? 'Internal error');
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
  async getRandomName(photoId: number) {
    let name: string;
    try {
      while (!name) {
        name = getRandomName();

        const row = await this.db
          .selectFrom('worldcup_votes')
          .where('photo_id', '=', photoId)
          .where('name', '=', name)
          .selectAll()
          .executeTakeFirst();

        if (row) {
          name = null;
        }
      }
      return {
        status: HttpStatus.OK,
        name: name,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
