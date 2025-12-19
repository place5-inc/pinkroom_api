import { Module, ModuleMetadata } from '@nestjs/common';
import { UserController } from './user/user.controller';
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
const modules: ModuleMetadata = {
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    HttpModule,
  ],
  controllers: [UserController, CommonController, AdminController],
  providers: [
    DatabaseProvider,
    UserService,
    UserRepository,
    AdminRepository,
    AdminService,
    AzureBlobService,
    CommonService,
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
export class AppModule {}
