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
      //await this.generateBeforeAfterThumbnail(photoId);
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
  async fontTest(photoId: number) {
    try {
      const url1 =
        await this.workerService.generateBeforeAfterThumbnailFontTest(photoId);
      // const url2 =
      //   await this.workerService.generateWorldcupMergedImageFontTest(photoId);
      // const url3 =
      //   await this.workerService.generateWorldcupThumbnailImageFontTest(
      //     photoId,
      //   );
      return {
        status: HttpStatus.OK,
        url: [url1],
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
      const now = new Date();
      const cutoff = new Date(now.getTime() - 2 * 60 * 1000);

      // 1) 만료 대상 photoId 먼저 조회
      const expired = await this.db
        .selectFrom('photo_results as pr')
        .innerJoin('photos as p', 'p.id', 'pr.original_photo_id')
        .select(['pr.original_photo_id as photoId'])
        .where('p.user_id', '=', userId)
        .where('pr.status', '=', 'pending')
        .where('pr.created_at', '<=', cutoff)
        .execute();

      const affectedPhotoIds = [...new Set(expired.map((r) => r.photoId))];

      if (affectedPhotoIds.length > 0) {
        // 2) 결과 fail 처리 (업데이트 테이블 alias 쓰지 말기)
        await this.db
          .updateTable('photo_results')
          .set({ status: 'fail' })
          .where('original_photo_id', 'in', affectedPhotoIds)
          .where('status', '=', 'pending')
          .where('created_at', '<=', cutoff)
          .execute();

        // 3) photos finished 처리
        await this.db
          .updateTable('photos')
          .set({ status: 'finished' })
          .where('id', 'in', affectedPhotoIds)
          .execute();
      }
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
        );
        if (result) {
          //before After Thumbnail 생성
          await this.workerService.generateBeforeAfterThumbnail(photo.id);
          if (!paymentId) {
            await this.photoRepository.updatePhotoStatus(photo.id, 'complete');
          }

          const item = await this.photoRepository.getPhotoById(photo.id);

          if (paymentId) {
            await this.photoRepository.updatePhotoStatus(
              photo.id,
              'rest_generating',
            );
            this.workerService.makeAllPhotos(photo.id);
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
  async remainingPhoto(userId: string, photoId: number, paymentId: number) {
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
      await this.photoRepository.updatePhotoStatus(photoId, 'rest_generating');
      await this.photoRepository.updatePhotoRetryCount(photoId, false);
      this.workerService.makeAllPhotos(photoId);
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
  async retryUploadPhoto(userId: string, photoId: number) {
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
      return { status: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    await this.photoRepository.updatePhotoRetryCount(photoId, true);

    const isPaid = !!photo.payment_id;

    const runRestGeneration = async () => {
      await this.photoRepository.updatePhotoStatus(photoId, 'rest_generating');
      this.workerService.makeAllPhotos(photoId);
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
      if (isPaid) await runRestGeneration();
      return { status: HttpStatus.OK };
    }

    // 첫 장이 없으면: 한 장 생성 시도
    const result = await this.workerService.makeOnlyOne(
      photo.id,
      photo.url,
      photo.selected_design_id,
      1,
    );

    if (!result) {
      await this.photoRepository.updatePhotoStatus(photo.id, 'finished');
      return { status: HttpStatus.REQUEST_TIMEOUT };
    }
    const item = await this.photoRepository.getPhotoById(photo.id);
    // 첫 장 성공 후 공통 처리
    if (isPaid) {
      await runRestGeneration();
    } else {
      await this.photoRepository.updatePhotoStatus(photoId, 'complete');
    }

    return { status: HttpStatus.OK, result: item };
  }
}
