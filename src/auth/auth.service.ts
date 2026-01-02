import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { VerificationService } from './verification.service';
import { MessageService } from 'src/message/message.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private verificationService: VerificationService,
    private messageService: MessageService,
    private userService: UserService,
    private readonly db: DatabaseProvider,
  ) {}

  async sendCode(phone: string) {
    const code = await this.verificationService.createdCode(phone);
    return await this.messageService.requestVerifyCode(phone, code);
  }

  async confirmCode(phone: string, code: string, sampleType?: string) {
    await this.verificationService.verifyCode(phone, code);

    let isNew = false;
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone, sampleType);
      isNew = true;
    }

    return {
      status: HttpStatus.OK,
      user,
      isNew,
    };
  }
  async verify(_token: string) {
    const token = await this.db
      .selectFrom('token')
      .where('token', '=', _token)
      .where('expired_at', '>', new Date())
      .selectAll()
      .executeTakeFirst();
    if (!token) {
      throw new NotFoundException('token not found');
    }

    const user = this.db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', token.user_id)
      .executeTakeFirst();
    return {
      status: HttpStatus.OK,
      user,
    };
  }
}
