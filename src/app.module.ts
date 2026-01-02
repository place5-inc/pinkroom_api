import { Module, ModuleMetadata } from '@nestjs/common';
import { UserService } from './user/user.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { CommonController } from './common/common.controller';
import { CommonService } from './common/common.service';
import { UserRepository } from './user/user.repository';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { DatabaseProvider } from './libs/db';
import { HttpModule } from '@nestjs/axios';
import { AzureBlobService } from './azure/blob.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminRepository } from './admin/admin.repository';
import { MessageService } from './message/message.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { VerificationService } from './auth/verification.service';
import { InicisController } from './inicis/inicis.controller';
import { InicisService } from './inicis/inicis.service';
import { PaymentService } from './payment/payment.service';
import { GeminiService } from './ai/gemini.service';
import { PhotoService } from './photo/photo.service';
import { PhotoWorkerService } from './photo/photo-worker.service';
import { UserController } from './user/user.controller';
import { ShareController } from './share/share.controller';
import { ShareService } from './share/share.service';
import { PhotoRepository } from './photo/photo.repository';
import { WorldcupController } from './worldcup/worldcup.controller';
import { WorldcupService } from './worldcup/worldcup.service';
import { KakaoService } from './kakao/kakao.service';
import { ThumbnailService } from './photo/thumbnail.service';
const modules: ModuleMetadata = {
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    HttpModule,
  ],
  controllers: [
    UserController,
    CommonController,
    AdminController,
    AuthController,
    InicisController,
    ShareController,
    WorldcupController,
  ],
  providers: [
    DatabaseProvider,
    UserService,
    UserRepository,
    AdminRepository,
    AdminService,
    AzureBlobService,
    CommonService,
    MessageService,
    AuthService,
    VerificationService,
    PhotoService,
    PhotoRepository,
    InicisService,
    PaymentService,
    GeminiService,
    PhotoWorkerService,
    ShareService,
    WorldcupService,
    KakaoService,
    ThumbnailService,
  ],
};

export type NODE_ENV = 'production' | 'staging' | 'development';

if (
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'staging'
) {
  if (process.env.CRON_SCHEDULER_ENABLED === 'on') {
    modules.imports.push(ScheduleModule.forRoot());
  }
}

@Module(modules)
export class AppModule { }
