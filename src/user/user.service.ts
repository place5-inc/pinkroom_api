import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
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
    const result = await this.db
      .insertInto('users')
      .values({
        phone,
        created_at: new Date(),
      })
      .executeTakeFirst();

    const id = Number(result.insertId);

    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }
}
