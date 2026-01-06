import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { UserVO } from 'src/libs/types';
type GetUserOptions = {
  includeDidShareWorldcup?: boolean; // 기본 false
};
@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseProvider) {}
  async getUser(
    userId: string,
    options: GetUserOptions = {},
  ): Promise<UserVO | null> {
    const { includeDidShareWorldcup = true } = options;

    const user = await this.db
      .selectFrom('users')
      .where('id', '=', userId)
      .selectAll()
      .executeTakeFirst();

    if (!user) return null;

    let didShareWorldcup = false;

    if (includeDidShareWorldcup) {
      const didShareRow = await this.db
        .selectFrom('photo_share_code')
        .leftJoin('photos', 'photos.id', 'photo_share_code.photo_id')
        .where('photos.user_id', '=', userId)
        .select('photo_share_code.id')
        .executeTakeFirst();

      didShareWorldcup = !!didShareRow;
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      sampleType: user.sample_type,
      didShareWorldcup,
    };
  }
}
