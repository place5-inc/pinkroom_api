import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoRepository } from 'src/photo/photo.repository';

@Injectable()
export class WorldcupService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoRepository: PhotoRepository,
  ) {}
  async getWorldcupList(userId: string) {
    try {
      const photos = await this.db
        .selectFrom('photos as p')
        .leftJoin('upload_file as uf', 'uf.id', 'p.upload_file_id')
        .where('p.user_id', '=', userId)
        .orderBy('p.id desc')
        .select([
          'p.id as photoId',
          'p.payment_id as paymentId',
          'uf.url as sourceImageUrl',
          'p.created_at',
        ])
        .execute();
      const photoIds = photos.map((p) => p.photoId);
      const votes = await this.db
        .selectFrom('worldcup_votes')
        .where('name', 'is not', null)
        .where('photo_id', 'in', photoIds)
        .selectAll()
        .execute();
      const voteCountByPhotoId = votes.reduce<Record<number, number>>(
        (acc, vote) => {
          acc[vote.photo_id] = (acc[vote.photo_id] ?? 0) + 1;
          return acc;
        },
        {},
      );
      const photosWithVoteCount = photos.map((photo) => ({
        ...photo,
        voteCount: voteCountByPhotoId[photo.photoId] ?? 0,
      }));
      return {
        status: HttpStatus.OK,
        results: photosWithVoteCount,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async getWorldcupReusults(userId: string, photoId: number) {
    try {
      const votes = await this.db
        .selectFrom('worldcup_votes')
        .where('photo_id', '=', photoId)
        .selectAll()
        .execute();

      const photoResults = await this.db
        .selectFrom('photo_results as pr')
        .leftJoin('upload_file as uf', 'uf.id', 'pr.result_image_id')
        .where('pr.original_photo_id', '=', photoId)
        .select([
          'pr.id as resultId',
          'pr.hair_design_id as designId',
          'uf.url as url',
        ])
        .execute();
      const votesByResultId = votes.reduce<Record<number, string[]>>(
        (acc, vote) => {
          // ✅ name이 없는 경우(user_id만 있는 경우 포함) 제외
          if (!vote.name) {
            return acc;
          }

          if (!acc[vote.result_id]) {
            acc[vote.result_id] = [];
          }

          acc[vote.result_id].push(vote.name);
          return acc;
        },
        {},
      );
      const photoResultsWithNames = photoResults.map((pr) => {
        const names = votesByResultId[pr.resultId] ?? [];

        return {
          ...pr,
          names,
          voteCount: names.length,
        };
      });
      const sortedPhotoResults = [...photoResultsWithNames].sort((a, b) => {
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return a.resultId - b.resultId;
      });
      const mySelect = votes.find(
        (vote) => vote.name == null && vote.user_id == userId,
      );
      if (mySelect) {
        const mySelectPhoto = photoResults.find(
          (result) => result.resultId == mySelect.result_id,
        );
        if (mySelectPhoto != null) {
          return {
            status: HttpStatus.OK,
            results: sortedPhotoResults,
            my: mySelectPhoto,
          };
        }
      }
      return {
        status: HttpStatus.OK,
        results: sortedPhotoResults,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async vote(
    _code?: string,
    photoId?: number,
    resultId?: number,
    name?: string,
    userId?: string,
  ) {
    try {
      let targetPhotoId: number | undefined;

      if (_code) {
        const shareCode = await this.db
          .selectFrom('photo_share_code')
          .where('code', '=', _code)
          //.where('expired_at','>',new Date())
          .selectAll()
          .executeTakeFirst();

        if (!shareCode) {
          throw new HttpException(
            '유효하지 않은 공유 코드입니다.',
            HttpStatus.NOT_FOUND,
          );
        }

        targetPhotoId = shareCode.photo_id;
      } else if (photoId != null) {
        targetPhotoId = photoId;
      } else {
        throw new HttpException(
          'code 또는 photoId가 필요합니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const photo = await this.db
        .selectFrom('photos')
        .where('id', '=', targetPhotoId)
        .selectAll()
        .executeTakeFirst();

      if (!photo) {
        throw new HttpException(
          '존재하지 않는 원본 사진입니다.',
          HttpStatus.NOT_FOUND,
        );
      }
      const result = await this.db
        .selectFrom('photo_results')
        .where('id', '=', resultId)
        .selectAll()
        .executeTakeFirst();
      if (!result) {
        throw new HttpException(
          '존재하지 않는 사진입니다.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (result.original_photo_id != photo.id) {
        throw new HttpException(
          '투표 id값이 잘못되었습니다.',
          HttpStatus.NOT_FOUND,
        );
      }
      const vote = await this.db
        .insertInto('worldcup_votes')
        .values({
          photo_id: photo.id,
          result_id: resultId,
          created_at: new Date(),
          name: name ?? null,
          user_id: userId ?? null,
        })
        .output(['inserted.id'])
        .executeTakeFirst();

      return {
        status: HttpStatus.OK,
        voteId: vote.id,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async changeName(voteId?: number, name?: string) {
    try {
      const vote = await this.db
        .updateTable('worldcup_votes')
        .where('id', '=', voteId)
        .set({
          name: name,
        })
        .executeTakeFirst();

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
  // async setLogFirstVote(photoId?: number, userId?: string) {
  //   try {
  //   } catch (e) {
  //     return {
  //       status: HttpStatus.INTERNAL_SERVER_ERROR,
  //       message: e.message,
  //     };
  //   }
  // }
}
