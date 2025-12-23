import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';

@Injectable()
export class VerificationService {
  constructor(private readonly db: DatabaseProvider) {}
  async createdCode(phone: string): Promise<string> {
    const randomNumber = Math.floor(Math.random() * 9000) + 1000;
    const code = randomNumber.toString();

    const now = new Date();
    const expireTime = new Date(now.getTime() + 5 * 60000);

    await this.db
      .insertInto('user_certification')
      .values({
        phone_number: phone,
        code,
        required_at: now,
        expire_time: expireTime,
      })
      .execute();

    return code;
  }
}
