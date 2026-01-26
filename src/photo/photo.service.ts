import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { AzureBlobService } from 'src/azure/blob.service';
import { Image } from 'src/libs/types';
import { PhotoWorkerService } from './photo-worker.service';
import { PhotoRepository } from './photo.repository';
import { sql } from 'kysely';
import { UserRepository } from 'src/user/user.repository';

@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly workerService: PhotoWorkerService,
    private readonly photoRepository: PhotoRepository,
    private readonly userRepository: UserRepository,
  ) {}
  private getCutoff(minutes = 2) {
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  async expirePendingResults(params: {
    userId?: string;
    photoId?: number;
    minutes?: number;
  }) {
    const cutoff = this.getCutoff(params.minutes ?? 2);

    // =====================================================
    // 1) pending -> fail (단, photo.updated_at이 최근 2분 이내면 스킵)
    // =====================================================
    let pendingExpireQ = this.db
      .selectFrom('photo_results as pr')
      .innerJoin('photos as p', 'p.id', 'pr.original_photo_id')
      .select(['pr.original_photo_id as photoId'])
      .where('pr.status', '=', 'pending')
      .where('pr.created_at', '<=', cutoff)
      // ✅ 최근 활동 있으면(2분 이내) pending 정리 안 함
      .where('p.updated_at', '<=', cutoff);

    if (params.photoId != null) {
      pendingExpireQ = pendingExpireQ.where(
        'pr.original_photo_id',
        '=',
        params.photoId,
      );
    }

    if (params.userId != null) {
      pendingExpireQ = pendingExpireQ.where('p.user_id', '=', params.userId);
    }

    const pendingExpired = await pendingExpireQ.execute();
    const pendingExpiredPhotoIds = [
      ...new Set(pendingExpired.map((r) => r.photoId)),
    ];

    if (pendingExpiredPhotoIds.length > 0) {
      await this.db
        .updateTable('photo_results')
        .set({ status: 'fail' })
        .where('original_photo_id', 'in', pendingExpiredPhotoIds)
        .where('status', '=', 'pending')
        .where('created_at', '<=', cutoff)
        .execute();
    }

    // =====================================================
    // 2) (결제한 건만) complete < 16 && 마지막 활동이 2분 이상 없으면 photos finished
    //    조건: photos.payment_id IS NOT NULL
    //          photos.updated_at <= cutoff
    // =====================================================
    let stuckIncompleteQ = this.db
      .selectFrom('photo_results as pr')
      .innerJoin('photos as p', 'p.id', 'pr.original_photo_id')
      .select(['pr.original_photo_id as photoId'])
      .where('p.payment_id', 'is not', null)
      // ✅ 최근 활동 있으면(2분 이내) finished 처리 안 함
      .where('p.updated_at', '<=', cutoff)
      .groupBy('pr.original_photo_id')
      // complete < 16
      .having(
        (eb) =>
          eb.fn.count(
            eb.case().when('pr.status', '=', 'complete').then(1).end(),
          ),
        '<',
        16,
      );

    if (params.photoId != null) {
      stuckIncompleteQ = stuckIncompleteQ.where(
        'pr.original_photo_id',
        '=',
        params.photoId,
      );
    }

    if (params.userId != null) {
      stuckIncompleteQ = stuckIncompleteQ.where(
        'p.user_id',
        '=',
        params.userId,
      );
    }

    const stuckRows = await stuckIncompleteQ.execute();
    const stuckPhotoIds = [...new Set(stuckRows.map((r) => r.photoId))];

    if (stuckPhotoIds.length > 0) {
      await this.photoRepository.updatePhotoStatuses(stuckPhotoIds, 'finished');
    }
  }
  async expirePendingResult(params: { photoId: number; minutes?: number }) {
    const cutoff = this.getCutoff(params.minutes ?? 2);
    const photoId = params.photoId;

    // =====================================================
    // 0) 대상 photo 한 건의 payment 여부 조회
    // =====================================================
    const photo = await this.db
      .selectFrom('photos')
      .select(['id', 'payment_id'])
      .where('id', '=', photoId)
      .executeTakeFirst();

    if (!photo) return;

    const isPaid = photo.payment_id != null;

    // =====================================================
    // 1) pending -> fail
    //    (단, "최근 활동" 판정은 photos.updated_at이 아니라
    //     photo_results의 마지막 기록 시각으로 판정)
    //
    //    조건:
    //      - status = pending
    //      - created_at <= cutoff
    //      - 그리고 해당 photo의 last_any(created_at) <= cutoff (최근 결과 기록 없음)
    // =====================================================
    const lastAnyRow = await this.db
      .selectFrom('photo_results as pr')
      .select((eb) => eb.fn.max('pr.created_at').as('lastAny'))
      .where('pr.original_photo_id', '=', photoId)
      .executeTakeFirst();

    const lastAny = lastAnyRow?.lastAny ?? null;

    if (lastAny != null && lastAny <= cutoff) {
      await this.db
        .updateTable('photo_results')
        .set({ status: 'fail' })
        .where('original_photo_id', '=', photoId)
        .where('status', '=', 'pending')
        .where('created_at', '<=', cutoff)
        .execute();
    }

    // =====================================================
    // 2) "멈춤" 판정 후 photos.status = finished
    //
    // [결제건]
    //   - complete < 16
    //   - last_any <= cutoff (2분 이상 아무 결과 기록 없음)
    //
    // [비결제건]
    //   - complete < 16 (16개 다 나온 상태면 멈춤/실패가 아님)
    //   - last_non_complete <= cutoff 이면 실패로 판단
    //   - 만약 last_non_complete가 null(= complete만 존재)이라면
    //       last_complete <= cutoff 이면 실패로 판단
    // =====================================================
    const agg = await this.db
      .selectFrom('photo_results as pr')
      .select((eb) => [
        eb.fn
          .count(eb.case().when('pr.status', '=', 'complete').then(1).end())
          .as('completeCnt'),

        eb.fn.max('pr.created_at').as('lastAny'),

        eb.fn
          .max(
            eb
              .case()
              .when('pr.status', '!=', 'complete')
              .then(eb.ref('pr.created_at'))
              .end(),
          )
          .as('lastNonComplete'),

        eb.fn
          .max(
            eb
              .case()
              .when('pr.status', '=', 'complete')
              .then(eb.ref('pr.created_at'))
              .end(),
          )
          .as('lastComplete'),
      ])
      .where('pr.original_photo_id', '=', photoId)
      .executeTakeFirst();

    const completeCnt = Number(agg?.completeCnt ?? 0);
    const lastAny2 = agg?.lastAny ?? null;
    const lastNonComplete = agg?.lastNonComplete ?? null;
    const lastComplete = agg?.lastComplete ?? null;

    // 16개 다 끝났으면 굳이 finished 처리할 필요 없음(이미 완료 플로우에서 처리될 것)
    if (completeCnt >= 16) return;

    let isStuck = false;

    if (isPaid) {
      // 결제건: "아무 결과 기록" 자체가 cutoff보다 오래되면 멈춤
      if (lastAny2 != null && lastAny2 <= cutoff) {
        isStuck = true;
      }
    } else {
      // 비결제건:
      // 1) complete 아닌 게 존재하면 그 마지막이 cutoff보다 오래되면 멈춤
      if (lastNonComplete != null) {
        if (lastNonComplete <= cutoff) isStuck = true;
      } else {
        // 2) complete만 존재하면 complete 마지막이 cutoff보다 오래되면 멈춤
        if (lastComplete != null && lastComplete <= cutoff) isStuck = true;
      }
    }

    if (isStuck) {
      await this.photoRepository.updatePhotoStatuses([photoId], 'finished');
    }
  }
  /*
  유저의 사진 리스트
   */
  async getPhotoList(userId: string) {
    try {
      //await this.expirePendingResults({ userId });

      const results = await this.photoRepository.getPhotosByUserId(userId);
      const user = await this.userRepository.getUser(userId);
      if (!user) {
        return { status: HttpStatus.UNAUTHORIZED };
      }
      return { status: HttpStatus.OK, results, user };
    } catch (e: any) {
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: e.message };
    }
  }
  /*
  사진 리스트
   */
  async getResultPhotoList(photoId: number) {
    try {
      await this.expirePendingResult({ photoId });

      const result = await this.photoRepository.getPhotoById(photoId);
      return { status: HttpStatus.OK, result };
    } catch (e: any) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async logDev(
    user_id: string,
    photo_id?: number,
    design_id?: number,
    code?: string,
    payment_id?: number,
    api?: string,
  ) {
    /*
    try {
      await this.db
        .insertInto('log_dev')
        .values({
          user_id,
          photo_id,
          design_id,
          code,
          payment_id,
          api,
          created_at: new Date(),
        })
        .execute();
    } catch (err) {
      console.error('log_dev insert failed', {
        user_id,
        photo_id,
        design_id,
        payment_id,
        api,
        code_len: code?.length,
        err,
      });
    }
    */
  }

  /* 
  유저가 사진 업로드
  */
  async uploadPhoto(
    userId: string,
    image: Image,
    designId: number,
    paymentId?: number,
    _code?: string,
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
  ) {
    this.logDev(userId, null, designId, _code, paymentId, 'upload');
    try {
      if (!paymentId && !_code) {
        throw new BadRequestException(
          'paymentId 또는 code 중 하나는 반드시 필요합니다.',
        );
      }
      if (paymentId) {
        const payment = await this.db
          .selectFrom('payments')
          .where('id', '=', paymentId)
          .selectAll()
          .execute();
        if (!payment) {
          throw new NotFoundException('결제를 찾을 수 없습니다.');
        }
        const beforePaymentPhoto = await this.db
          .selectFrom('photos')
          .where('payment_id', '=', paymentId)
          .selectAll()
          .executeTakeFirst();
        if (beforePaymentPhoto) {
          throw new ConflictException('이미 결제된 id 입니다.');
        }
      }
      if (_code) {
        const code = await this.db
          .selectFrom('photo_share_code')
          .where('code', '=', _code)
          .selectAll()
          .executeTakeFirst();
        if (!code) {
          throw new NotFoundException('코드를 찾을 수 없습니다.');
        }
        if (code.expired_at < new Date()) {
          throw new BadRequestException('이미 만료된 코드입니다.');
        }
        const codePhoto = await this.db
          .selectFrom('photos')
          .where('id', '=', code.photo_id)
          .selectAll()
          .executeTakeFirst();
        if (!codePhoto) {
          throw new NotFoundException('코드의 사진 정보를 찾을 수 없습니다.');
        }
        if (!codePhoto.payment_id) {
          throw new BadRequestException(
            '공유된 코드는 무료 체험이 가능한 코드가 아닙니다.',
          );
        }
        if (codePhoto.user_id === userId) {
          throw new BadRequestException(
            '본인의 공유 코드로는 무료 혜택을 받을 수 없습니다.',
          );
        }
        const row = await this.db
          .selectFrom('users')
          .where('use_code_photo_id', '=', code.photo_id)
          .select(sql<number>`count(*)`.as('count'))
          .executeTakeFirst();

        const useCount = row?.count ?? 0;
        const limit = Number(process.env.CODE_SHARE_LIMIT ?? 0);
        if (useCount >= limit) {
          throw new ForbiddenException('코드 사용 가능 횟수를 초과했습니다.');
        }
        const result = await this.db
          .updateTable('users')
          .where('id', '=', userId)
          .where('use_code_photo_id', 'is', null) // 조건부 업데이트
          .set({
            use_code_id: _code,
            use_code_photo_id: code.photo_id,
          })
          .executeTakeFirst();

        if (result.numUpdatedRows === 0n) {
          throw new BadRequestException('이미 사용한 코드가 있습니다.');
        }
        /* 꿀현진 결제한 유저는 무료 쿠폰 사용 못하게 하려면 이 주소 풀면 됨
        const _photos = await this.db
          .selectFrom('photos')
          .where('user_id', '=', userId)
          .where('payment_id', 'is not', null)
          .selectAll()
          .executeTakeFirst();
        if (_photos) {
          throw new BadRequestException('이미 결제한 유저입니다.');
        }
          */
      }

      const uploadedFile = await this.azureBlobService.uploadFileImage(image);
      const photo = await this.db
        .insertInto('photos')
        .values({
          user_id: userId,
          upload_file_id: uploadedFile?.id ?? null,
          created_at: new Date(),
          updated_at: new Date(),
          payment_id: paymentId,
          code: _code,
          selected_design_id: designId,
          status: null,
        })
        .output(['inserted.id'])
        .executeTakeFirst();
      await this.photoRepository.updatePhotoStatus(
        photo.id,
        'first_generating',
      );
      const prompt = await this.db
        .selectFrom('prompt')
        .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
        .where('prompt.design_id', '=', designId)
        .select([
          'prompt.design_id as designId',
          'prompt.ment',
          'upload_file.url as imageUrl',
        ])
        .executeTakeFirst();
      if (!prompt) {
        throw new NotFoundException('prompt를 찾을 수 없습니다.');
      }
      let attempt = 0;

      while (attempt < 2) {
        attempt++;
        const result = await this.workerService.generatePhoto(
          photo.id,
          uploadedFile.url,
          designId,
          prompt.ment,
          prompt.imageUrl,
          attempt,
          isDummy,
          forceFail,
          delaySecond,
          designId,
        );
        if (result) {
          //before After Thumbnail 생성
          await this.photoRepository.generateBeforeAfterThumbnail(photo.id);
          if (!paymentId) {
            await this.photoRepository.updatePhotoStatus(photo.id, 'complete');
          }

          const item = await this.photoRepository.getPhotoById(photo.id);

          if (paymentId) {
            await this.photoRepository.updatePhotoStatus(
              photo.id,
              'rest_generating',
            );
            this.workerService.makeAllPhotos(
              photo.id,
              isDummy,
              forceFail,
              delaySecond,
            );
          }
          return {
            status: HttpStatus.OK,
            result: item,
          };
        }
      }
      await this.photoRepository.updatePhotoStatus(photo.id, 'finished');
      this.workerService.failMakePhoto(userId, 'first');
      return {
        status: HttpStatus.BAD_REQUEST,
        errorType: 'gemini_error',
      };
    } catch (e) {
      throw new HttpException(
        e.message,
        e.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /*
  전체 사진 생성
  쿠폰으로 한개 만들고, 이후에 결제했을 떄
   */
  async remainingPhoto(
    userId: string,
    photoId: number,
    paymentId: number,
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
  ) {
    this.logDev(userId, photoId, null, null, paymentId, 'retry');
    try {
      const _payment = await this.db
        .selectFrom('payments')
        .where('id', '=', paymentId)
        .where('user_id', '=', userId)
        .selectAll()
        .executeTakeFirst();
      if (!_payment) {
        throw new NotFoundException('결제내역을 찾을 수 없습니다.');
      }
      const result = await this.db
        .updateTable('photos')
        .where('id', '=', photoId)
        .where('user_id', '=', userId)
        .where('payment_id', 'is', null)
        .set({
          payment_id: paymentId,
          updated_at: new Date(),
        })
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        throw new NotFoundException('사진을 찾을 수 없습니다.');
      }
      await this.photoRepository.updatePhotoStatus(photoId, 'rest_generating');
      await this.photoRepository.updatePhotoRetryCount(photoId, 0);
      this.workerService.makeAllPhotos(
        photoId,
        isDummy,
        forceFail,
        delaySecond,
      );

      const item = await this.photoRepository.getPhotoById(photoId);

      return {
        status: HttpStatus.OK,
        result: item,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  /*
  이미 원본 있을 때, 하나의 디자인 만들기
  실패한거용인데, 사용 안하는것 같음
   */
  async retryUploadPhoto(
    userId: string,
    photoId: number,
    retryCount?: number,
    isDummy?: boolean,
    forceFail?: boolean,
    delaySecond?: number,
  ) {
    this.logDev(userId, photoId, null, null, null, 'retry');
    const photo = await this.db
      .selectFrom('photos')
      .leftJoin('upload_file', 'upload_file.id', 'photos.upload_file_id')
      .where('photos.id', '=', photoId)
      .select([
        'photos.id',
        'payment_id',
        'status',
        'selected_design_id',
        'upload_file.url',
      ])
      .executeTakeFirst();

    if (!photo) {
      return { status: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    await this.photoRepository.updatePhotoRetryCount(photoId, retryCount);

    const isPaid = !!photo.payment_id;

    const runRestGeneration = async () => {
      await this.photoRepository.updatePhotoStatus(photoId, 'rest_generating');
      this.workerService.makeAllPhotos(
        photoId,
        isDummy,
        forceFail,
        delaySecond,
      );
    };

    const photoResult = await this.db
      .selectFrom('photo_results')
      .where('original_photo_id', '=', photoId)
      .where('hair_design_id', '=', photo.selected_design_id)
      .where('status', '=', 'complete')
      .selectAll()
      .executeTakeFirst();

    // 첫 장이 이미 있으면: 결제건만 나머지 생성 트리거
    if (photoResult) {
      if (isPaid) {
        await runRestGeneration();
      } else {
        await this.photoRepository.updatePhotoStatus(photoId, 'complete');
      }

      return { status: HttpStatus.OK };
    }

    // 첫 장이 없으면: 한 장 생성 시도
    this.workerService.makeOnlyOne(
      photo.id,
      photo.url,
      photo.selected_design_id,
      1,
      isDummy,
      forceFail,
      delaySecond,
      isPaid,
    );

    return { status: HttpStatus.OK };
  }
  async markCompletePopupShown(photoId: number) {
    try {
      await this.photoRepository.updateCompletePopupShown(photoId);
      return { status: HttpStatus.OK };
    } catch (e: any) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  async markFreeCompletePopupShown(photoId: number) {
    try {
      await this.photoRepository.updateFreeCompletePopupShown(photoId);
      return { status: HttpStatus.OK };
    } catch (e: any) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
