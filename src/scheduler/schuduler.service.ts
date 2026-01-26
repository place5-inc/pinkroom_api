//스케쥴러 서비스

import { Injectable } from '@nestjs/common';
import { Cron, CronOptions } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { DatabaseProvider } from 'src/libs/db';
import { NIL } from 'uuid';
import { DEV_CONFIG } from 'src/libs/types';
import { NODE_ENV } from 'src/app.module';
import { MessageService } from 'src/message/message.service';
import { KakaoSchedulerService } from 'src/kakao/kakao.scheduler.service';
import { sql, RawBuilder } from 'kysely';

@Injectable()
export class SchedulerService {
  private readonly db = new DatabaseProvider();
  private readonly messageService = new MessageService();

  @CronForENV(['production'], '0 7 * * *') //매일 16시에 동작
  public async completeVoteWorldcupRemindWeek() {
    try {
      const isPublish = await this.checkSchedulerPublishState(
        'complete_vote_worldcup_remind_week',
      );
      if (!isPublish) {
        return;
      }
      //스케줄러 로그에 시작 시간 업데이트 하고 실행
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_week',
        'start',
      );

      const targetWorldcupLogs = await this.db
        .selectFrom('worldcup_log')
        .where('first_vote_at', 'is not', null)
        .where(({ eb }) =>
          eb(
            sql`CAST(DATEADD(day, 7, first_vote_at) AS DATE)`,
            '=',
            sql`CAST(GETDATE() AS DATE)`,
          ),
        )
        .where((qb) =>
          qb.or([
            qb('accessed_at', 'is', null),
            qb('last_vote_at', '>', qb.ref('accessed_at')),
          ]),
        )
        .select(['user_id', 'photo_id'])
        .execute();
      if (targetWorldcupLogs.length > 0) {
        for (const target of targetWorldcupLogs) {
          try {
            const { token } = await KakaoSchedulerService.setTokenByScheduler(
              this.db,
              target.user_id,
            );
            await KakaoSchedulerService.sendKakaoNotificationForScheduler(
              this.db,
              target.user_id,
              'pr_cplt_wrc_rmd_week_v1',
              null,
              [],
              [token, target.photo_id.toString()],
            );
          } catch (userError) {
            await this.writeSchedulerLog(
              'complete_vote_worldcup_remind_week',
              'fail',
            );
            const errorText =
              userError instanceof Error
                ? `${userError.name}: ${userError.message}\n${userError.stack}`
                : JSON.stringify(userError);
            await this.sendMMSMessageForDeveloper(
              `핑크룸 - type : complete_vote_worldcup_remind_week\n 스케줄러 오류 발생\n${errorText.slice(0, 500)}`,
              'complete_vote_worldcup_remind_week',
            );
            continue;
          }
        }
      }

      //스케줄러 로그에 성공 시간 업데이트 하고 실행
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_week',
        'success',
      );
    } catch (error) {
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_week',
        'fail',
      );
      const errorText =
        error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack}`
          : JSON.stringify(error);
      await this.sendMMSMessageForDeveloper(
        `핑크룸 - type : complete_vote_worldcup_remind_week\n 스케줄러 오류 발생\n${errorText.slice(0, 500)}`,
        'complete_vote_worldcup_remind_week',
      );
    } finally {
      console.log(
        'type : complete_vote_worldcup_remind_week - 스케줄러 실행 완료',
      );
    }
  }

  @CronForENV(['production'], '0 7 * * *') //매일 16시에 동작
  public async completeVoteWorldcupRemindMonth() {
    try {
      const isPublish = await this.checkSchedulerPublishState(
        'complete_vote_worldcup_remind_month',
      );
      if (!isPublish) {
        return;
      }
      //스케줄러 로그에 시작 시간 업데이트 하고 실행
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_month',
        'start',
      );

      const targetWorldcupLogs = await this.db
        .selectFrom('worldcup_log')
        .where('first_vote_at', 'is not', null)
        .where(({ eb }) =>
          eb(
            sql`CAST(DATEADD(day, 30, first_vote_at) AS DATE)`,
            '=',
            sql`CAST(GETDATE() AS DATE)`,
          ),
        )
        .where((qb) =>
          qb.or([
            qb('accessed_at', 'is', null),
            qb('last_vote_at', '>', qb.ref('accessed_at')),
          ]),
        )
        .select(['user_id', 'photo_id'])
        .execute();
      if (targetWorldcupLogs.length > 0) {
        for (const target of targetWorldcupLogs) {
          try {
            const { token } = await KakaoSchedulerService.setTokenByScheduler(
              this.db,
              target.user_id,
            );
            await KakaoSchedulerService.sendKakaoNotificationForScheduler(
              this.db,
              target.user_id,
              'pr_cplt_wrc_rmd_month_v1',
              null,
              [],
              [token, target.photo_id.toString()],
            );
          } catch (userError) {
            await this.writeSchedulerLog(
              'complete_vote_worldcup_remind_month',
              'fail',
            );
            const errorText =
              userError instanceof Error
                ? `${userError.name}: ${userError.message}\n${userError.stack}`
                : JSON.stringify(userError);
            await this.sendMMSMessageForDeveloper(
              `핑크룸 - type : complete_vote_worldcup_remind_month\n 스케줄러 오류 발생\n${errorText.slice(0, 500)}`,
              'complete_vote_worldcup_remind_month',
            );
            continue;
          }
        }
      }

      //스케줄러 로그에 성공 시간 업데이트 하고 실행
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_month',
        'success',
      );
    } catch (error) {
      await this.writeSchedulerLog(
        'complete_vote_worldcup_remind_month',
        'fail',
      );
      const errorText =
        error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack}`
          : JSON.stringify(error);
      await this.sendMMSMessageForDeveloper(
        `핑크룸 - type : complete_vote_worldcup_remind_month\n 스케줄러 오류 발생\n${errorText.slice(0, 500)}`,
        'complete_vote_worldcup_remind_month',
      );
    } finally {
      console.log(
        'type : complete_vote_worldcup_remind_month - 스케줄러 실행 완료',
      );
    }
  }
  public async checkSchedulerPublishState(type: string) {
    const schedulerLog = await this.db
      .selectFrom('scheduler_log')
      .where('type', '=', type)
      .selectAll()
      .executeTakeFirst();
    if (schedulerLog) {
      return schedulerLog.is_publish === true;
    }
    return false;
  }
  public async writeSchedulerLog(type: string, state: string) {
    const now = DateTime.now().toJSDate();
    if (state === 'start') {
      await this.db
        .updateTable('scheduler_log')
        .set({
          start_at: now,
        })
        .where('type', '=', type)
        .execute();
    } else if (state === 'success') {
      await this.db
        .updateTable('scheduler_log')
        .set({
          success_at: now,
        })
        .where('type', '=', type)
        .execute();
    } else if (state === 'fail') {
      await this.db
        .updateTable('scheduler_log')
        .set({
          fail_at: now,
        })
        .where('type', '=', type)
        .execute();
    }
  }

  public async sendMMSMessageForDeveloper(errorMessage: string, type?: string) {
    let phoneNumbers = ['01053095304', '01054697884', '01073002335'];

    if (type) {
      //5분 사이에 해당 타입의 실패 메시지가 발송된 이력이 있었다면 또 발송하지는 않음.
      const fiveMinutesAgo = DateTime.now().minus({ minutes: 5 }).toJSDate();
      const kakaoLogs = await this.db
        .selectFrom('kakao_log')
        .where('created_at', '>=', fiveMinutesAgo)
        .where('template_code', '=', type)
        .selectAll()
        .execute();
      if (kakaoLogs.length > 0) {
        return;
      }
    }
    let title = '핑크룸 서버 오류 안내';
    if (process.env.NODE_ENV === 'production') {
    } else {
      title = '핑크룸 (테스트) 서버 오류 안내';
    }
    for (const phoneNumber of phoneNumbers) {
      await this.messageService.sendMMS(
        phoneNumber,
        errorMessage.slice(0, 500),
        title,
        null,
      );
      //에러 발생시 문자 발송 기록은 카카오 로그 테이블에 저장.
      await this.insertKakaoLog(
        type,
        phoneNumber,
        title,
        errorMessage.slice(0, 500),
      );
    }
  }
  public async insertKakaoLog(
    type: string,
    phoneNumber: string,
    title: string,
    errorMessage: string,
  ) {
    await this.db
      .insertInto('kakao_log')
      .values({
        user_id: NIL,
        phone_number: phoneNumber,
        template_code: type,
        created_at: DateTime.now().toJSDate(),
        json: JSON.stringify({
          title: title,
        }),
        result_code: null,
        exception_message: errorMessage,
      })
      .execute();
  }
}

export function CronForENV(
  envs: NODE_ENV[],
  cronTime: string,
  options?: CronOptions,
) {
  if (envs.includes(process.env.NODE_ENV as NODE_ENV)) {
    return Cron(cronTime, options);
  }

  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    console.log(
      `[Scheduler] Cron job '${target.constructor.name}.${key}' is disabled in '${process.env.NODE_ENV}' environment.`,
    );
    return descriptor;
  };
}
