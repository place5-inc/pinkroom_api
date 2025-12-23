import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { randomUUID } from 'crypto';
@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseProvider) {}
  async findByPhone(phone: string) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', phone)
      .executeTakeFirst();
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
