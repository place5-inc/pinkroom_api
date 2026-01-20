import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { UserVO } from 'src/libs/types';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseProvider) {}
  private toVO(user: any): UserVO {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      sampleType: user.sample_type,
      hasUsedFree: user.use_code_id != null,
    };
  }

  private async findOneBy(
    field: 'id' | 'phone',
    value: string,
  ): Promise<UserVO | null> {
    const _user = await this.db
      .selectFrom('users')
      .where(field, '=', value)
      .selectAll()
      .executeTakeFirst();
    if (!_user) {
      return null;
    }
    const _photos = await this.db
      .selectFrom('photos')
      .where('user_id', '=', _user.id)
      .where('payment_id', 'is not', null)
      .selectAll()
      .executeTakeFirst();
    let user = this.toVO(_user);
    if (_photos) {
      user.hasUsedFree = true;
      //꿀현진 - 결제한 유저가 무료코드 이용하게 하려면, 바로 위에 줄 주석 처리하면됨.
      //_photos도 필요 없음.
    }

    return user;
  }

  getUser(userId: string): Promise<UserVO | null> {
    return this.findOneBy('id', userId);
  }

  getUserByPhone(phone: string): Promise<UserVO | null> {
    return this.findOneBy('phone', phone);
  }
}
