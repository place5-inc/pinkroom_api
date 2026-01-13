import {
  BadRequestException,
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
import { ThumbnailService } from './thumbnail.service';
import { UserRepository } from 'src/user/user.repository';

@Injectable()
export class PhotoService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly workerService: PhotoWorkerService,
    private readonly photoRepository: PhotoRepository,
    private readonly thumbnailService: ThumbnailService,
    private readonly userRepository: UserRepository,
  ) {}
  async test(photoId: number) {
    try {
      await this.generateBeforeAfterThumbnail(photoId);
      return {
        status: HttpStatus.OK,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }

  /*
  유저의 사진 리스트
   */
  async getPhotoList(userId: string) {
    try {
      // 3) 최신 상태로 조회해서 응답
      const results = await this.photoRepository.getPhotosByUserId(userId);
      const user = await this.userRepository.getUser(userId);

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
      const now = new Date();
      const cutoff = new Date(now.getTime() - 2 * 60 * 1000); // 2분 전
      const upd = await this.db
        .updateTable('photo_results')
        .set({
          status: 'fail',
        })
        .where('original_photo_id', '=', photoId)
        .where('status', '=', 'pending')
        .where('created_at', '<=', cutoff)
        .executeTakeFirst();

      // Kysely에서 업데이트된 row 수
      const changed =
        typeof upd.numUpdatedRows === 'bigint'
          ? Number(upd.numUpdatedRows)
          : (upd.numUpdatedRows ?? 0);

      // 2) 변경된 게 "있으면" photos.status를 finished로 변경
      if (changed > 0) {
        await this.db
          .updateTable('photos')
          .set({
            status: 'finished',
          })
          .where('id', '=', photoId)
          .execute();
      }

      const result = await this.photoRepository.getPhotoById(photoId);

      return {
        status: HttpStatus.OK,
        result,
      };
    } catch (e: any) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
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
    isLowVersion?: boolean,
  ) {
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

        const row = await this.db
          .selectFrom('users')
          .where('use_code_photo_id', '=', code.photo_id)
          .select(sql<number>`count(*)`.as('count'))
          .executeTakeFirst();

        const useCount = row?.count ?? 0;
        if (useCount > 15) {
          throw new ForbiddenException('코드 사용 가능 횟수를 초과했습니다.');
        }
        const user = await this.db
          .selectFrom('users')
          .where('id', '=', userId)
          .selectAll()
          .executeTakeFirst();
        if (!user) {
          throw new NotFoundException('유저 정보를 찾을 수 없습니다.');
        }
        if (user.use_code_photo_id != null) {
          throw new BadRequestException('이미 사용한 코드가 있습니다.');
        }
        await this.db
          .updateTable('users')
          .where('id', '=', userId)
          .set({
            use_code_id: _code,
            use_code_photo_id: code.photo_id,
          })
          .execute();
      }

      const uploadedFile = await this.azureBlobService.uploadFileImage(image);
      const photo = await this.db
        .insertInto('photos')
        .values({
          user_id: userId,
          upload_file_id: uploadedFile?.id ?? null,
          created_at: new Date(),
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
          isLowVersion,
        );
        if (result) {
          //before After Thumbnail 생성
          await this.generateBeforeAfterThumbnail(photo.id);
          if (!paymentId) {
            await this.photoRepository.updatePhotoStatus(photo.id, 'complete');
          }

          const item = await this.photoRepository.getPhotoById(photo.id);

          if (paymentId) {
            await this.photoRepository.updatePhotoStatus(
              photo.id,
              'rest_generating',
            );
            this.workerService.makeAllPhotos(photo.id, isLowVersion);
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
        status: HttpStatus.REQUEST_TIMEOUT,
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
    isLowVersion?: boolean,
  ) {
    try {
      const result = await this.db
        .updateTable('photos')
        .where('id', '=', photoId)
        .where('user_id', '=', userId)
        .where('payment_id', 'is', null)
        .set({
          payment_id: paymentId,
        })
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        throw new NotFoundException('사진을 찾을 수 없습니다.');
      }
      await this.photoRepository.updatePhotoRetryCount(photoId, false);
      this.workerService.makeAllPhotos(photoId, isLowVersion);
      return {
        status: HttpStatus.OK,
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
    isLowVersion?: boolean,
  ) {
    const photo = await this.db
      .selectFrom('photos')
      .leftJoin('upload_file', 'upload_file.id', 'photos.upload_file_id')
      .where('photos.id', '=', photoId)
      .select([
        'photos.id',
        'payment_id',
        'selected_design_id',
        'upload_file.url',
      ])
      .executeTakeFirst();
    if (!photo) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
    await this.photoRepository.updatePhotoRetryCount(photoId, true);

    if (photo.payment_id) {
      this.workerService.makeAllPhotos(photoId, isLowVersion);
    } else {
      const photoResult = await this.db
        .selectFrom('photo_results')
        .where('original_photo_id', '=', photoId)
        .where('hair_design_id', '=', photo.selected_design_id)
        .where('status', '=', 'complete')
        .selectAll()
        .executeTakeFirst();
      if (!photoResult) {
        const prompt = await this.db
          .selectFrom('prompt')
          .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
          .where('prompt.design_id', '=', photo.selected_design_id)
          .select([
            'prompt.design_id as designId',
            'prompt.ment',
            'upload_file.url as imageUrl',
          ])
          .executeTakeFirst();
        if (!prompt) {
          throw new NotFoundException('prompt를 찾을 수 없습니다.');
        }
        this.workerService.generatePhoto(
          photo.id,
          photo.url,
          photo.selected_design_id,
          prompt.ment,
          prompt.imageUrl,
          1,
          isLowVersion,
        );
      }
    }
    return {
      status: HttpStatus.OK,
    };
  }
  /*
  썸네일 before After 만들기
   */
  async generateBeforeAfterThumbnail(photoId: number) {
    const photo = await this.db
      .selectFrom('photos as p')
      .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
      .where('p.id', '=', photoId)
      .select([
        'p.id as photoId',
        'p.thumbnail_before_after_id as thumbnail_before_after_id',
        'p.selected_design_id as selected_design_id',
        'uf.url as beforeUrl',
      ])
      .executeTakeFirst();
    if (!photo) {
      return;
    }
    const after = await this.db
      .selectFrom('photo_results as pf')
      .leftJoin('upload_file as uf', 'uf.id', 'pf.result_image_id')
      .where('original_photo_id', '=', photoId)
      .where('hair_design_id', '=', photo.selected_design_id)
      .select(['uf.url as afterUrl'])
      .executeTakeFirst();

    const MAX_THUMBNAIL_RETRY = 2;
    for (let i = 0; i < MAX_THUMBNAIL_RETRY; i++) {
      try {
        const thumbnailBuffer = await this.thumbnailService.generateBeforeAfter(
          photo.beforeUrl,
          after.afterUrl,
        );

        const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString(
          'base64',
        )}`;
        const thumbnailUpload =
          await this.azureBlobService.uploadFileImageBase64(thumbnailBase64);

        if (thumbnailUpload) {
          await this.db
            .updateTable('photos')
            .set({ thumbnail_before_after_id: thumbnailUpload.id })
            .where('id', '=', photoId)
            .execute();
          console.log(`[PhotoService] 썸네일 생성 성공 (${i + 1}번째 시도)`);
          break; // 성공 시 루프 탈출
        }
      } catch (error) {
        console.error(
          `[PhotoService] 썸네일 생성 실패 (${i + 1}번째 시도):`,
          error,
        );
        if (i === MAX_THUMBNAIL_RETRY - 1) {
          console.error('[PhotoService] 썸네일 최종 생성 실패');
        }
      }
    }
  }

  async checkNeedMakePhotos(userId: string) {
    const photos = await this.db
      .selectFrom('photos')
      .where('user_id', '=', userId)
      .select('id')
      .execute();

    for (const { id } of photos) {
      await this.checkNeedMakePhoto(userId, id);
    }
  }

  async checkNeedMakePhoto(userId: string, photoId: number) {
    try {
      const result = await this.photoRepository.getPhotoById(photoId);

      if (result?.paymentId) {
        const imgs = result.resultImages ?? [];

        const completeCount = imgs.reduce(
          (acc, img) => acc + (img.status === 'complete' ? 1 : 0),
          0,
        );

        if (completeCount < 16) {
          const toTime = (s?: string) => (s ? new Date(s).getTime() : NaN);

          // 1) complete 아닌 것 중 "가장 오래된" 1개
          const oldestNotComplete = imgs
            .filter((img) => img.status !== 'complete' && !!img.createdAt)
            .reduce<(typeof imgs)[number] | null>((best, cur) => {
              if (!best) return cur;
              return toTime(cur.createdAt) < toTime(best.createdAt)
                ? cur
                : best; // 최소
            }, null);

          // 2) 없다면 complete 중 "가장 최신" 1개
          const newestComplete = imgs
            .filter((img) => img.status === 'complete' && !!img.createdAt)
            .reduce<(typeof imgs)[number] | null>((best, cur) => {
              if (!best) return cur;
              return toTime(cur.createdAt) > toTime(best.createdAt)
                ? cur
                : best; // 최대
            }, null);

          const target = oldestNotComplete ?? newestComplete;

          if (target) {
            const oneMinuteAgo = Date.now() - 60_000;
            const targetTime = toTime(target.createdAt);

            const isOlderThan1Min = targetTime <= oneMinuteAgo;

            // TODO: 비교 결과로 분기
            if (isOlderThan1Min) {
              this.workerService.makeAllPhotos(photoId, false);
            }
          }
        }
      } else if (result?.code) {
        const imgs = result.resultImages ?? [];

        const completeCount = imgs.reduce(
          (acc, img) => acc + (img.status === 'complete' ? 1 : 0),
          0,
        );
        if (completeCount < 1) {
          const toTime = (s?: string) => (s ? new Date(s).getTime() : NaN);

          // 1) complete 아닌 것 중 "가장 오래된" 1개
          const oldestNotComplete = imgs
            .filter((img) => img.status !== 'complete' && !!img.createdAt)
            .reduce<(typeof imgs)[number] | null>((best, cur) => {
              if (!best) return cur;
              return toTime(cur.createdAt) < toTime(best.createdAt)
                ? cur
                : best; // 최소
            }, null);
          const target = oldestNotComplete ?? null;
          if (target) {
            const oneMinuteAgo = Date.now() - 60_000;
            const targetTime = toTime(target.createdAt);

            const isOlderThan1Min = targetTime <= oneMinuteAgo;

            // TODO: 비교 결과로 분기
            if (isOlderThan1Min) {
              //this.retryUploadPhoto(userId, photoId);
              //this.workerService.makeAllPhotos(photoId);
            }
          }
        }
      }
    } catch (e) {}
  }
}
