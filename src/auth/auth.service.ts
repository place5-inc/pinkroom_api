import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { VerificationService } from './verification.service';
import { MessageService } from 'src/message/message.service';
import { UserService } from 'src/user/user.service';
import { KakaoService } from 'src/kakao/kakao.service';

@Injectable()
export class AuthService {
  constructor(
    private verificationService: VerificationService,
    private messageService: MessageService,
    private userService: UserService,
    private readonly db: DatabaseProvider,
    private readonly kakaoService: KakaoService,
  ) {}

  async sendCode(phone: string) {
    const code = await this.verificationService.createdCode(phone);
    return await this.messageService.requestVerifyCode(phone, code);
  }

  async confirmCode(phone: string, code: string, sampleType?: number) {
    await this.verificationService.verifyCode(phone, code);

    let isNew = false;
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone, sampleType);
      isNew = true;

      //알림톡보내기 (실패해도 회원가입은 성공하도록 처리)
      try {
        await this.kakaoService.sendKakaoNotification(
          user.id,
          'pr_wlcm_snup_v1',
          null,
          [],
          [],
        );
      } catch (error) {
        console.error('[회원가입 알림톡 발송 실패]', error);
      }
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

    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', token.user_id)
      .executeTakeFirst();
    return {
      status: HttpStatus.OK,
      user,
    };
  }
}
