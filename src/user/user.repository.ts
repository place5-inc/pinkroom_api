import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { UserVO } from 'src/libs/types';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseProvider) {}

  async getUser(userId: string): Promise<UserVO | null> {
    const user = await this.db
      .selectFrom('users')
      .where('id', '=', userId)
      .selectAll()
      .executeTakeFirst();

    if (!user) return null;

    if (!user) return null;

    const didShareRow = await this.db
      .selectFrom('photo_share_code')
      .leftJoin('photos', 'photos.id', 'photo_share_code.photo_id')
      .where('photos.user_id', '=', userId)
      .select('photo_share_code.id') // 존재 여부만 필요하니 최소 컬럼만
      .executeTakeFirst();

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      sampleType: user.sample_type,
      didShareWorldcup: !!didShareRow,
    };
  }
}
