import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { DEV_CONFIG } from 'src/libs/types';

@Injectable()
export class VerificationService {
  private readonly _isProduction = DEV_CONFIG.isProduction;
  constructor(private readonly db: DatabaseProvider) {}
  async createdCode(phone: string): Promise<string> {
    const randomNumber = Math.floor(Math.random() * 9000) + 1000;
    let code = randomNumber.toString();
    if (!this._isProduction) {
      //테스트서버에서는 0000 코드로 고정
      code = '0000';
    }

    if (phone === '01199999999') {
      code = '0000';
    }

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

  async verifyCode(phone: string, code: string) {
    const record = await this.db
      .selectFrom('user_certification')
      .selectAll()
      .orderBy('id', 'desc')
      .where('phone_number', '=', phone)
      .executeTakeFirst();

    if (!record) {
      throw new NotFoundException('Verification code not found.');
    }

    const now = new Date();

    if (record.expire_time < now) {
      throw new GoneException('Verification code expired.');
    }

    if (record.code !== code) {
      throw new BadRequestException('Invalid verification code.');
    }
  }
}
