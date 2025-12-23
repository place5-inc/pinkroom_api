import { HttpStatus, Injectable } from '@nestjs/common';
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
  ) {}

  async sendCode(phone: string) {
    const code = await this.verificationService.createdCode(phone);
    await this.messageService.requestVerifyCode(phone, code);
  }

  async confirmCode(phone: string, code: string) {
    await this.verificationService.verifyCode(phone, code);

    const user =
      (await this.userService.findByPhone(phone)) ??
      (await this.userService.createUser(phone));
    return {
      status: HttpStatus.OK,
      userId: user?.id,
    };
  }
}
