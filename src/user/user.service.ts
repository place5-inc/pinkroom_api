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
  async createUser(phone: string, sampleType?: number) {
    const id = randomUUID();
    const name = phone.slice(-4); // 마지막 4글자
    await this.db
      .insertInto('users')
      .values({
        id,
        phone,
        created_at: new Date(),
        name,
        sample_type: sampleType ?? null,
      })
      .executeTakeFirst();

    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }
}
