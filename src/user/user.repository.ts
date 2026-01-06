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

    let didShareWorldcup = false;

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      sampleType: user.sample_type,
    };
  }
}
