import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { PhotoRepository } from 'src/photo/photo.repository';
import { KakaoService } from 'src/kakao/kakao.service';
import { generateCode } from 'src/libs/helpers';
import { UserRepository } from 'src/user/user.repository';
@Injectable()
export class WorldcupService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly photoRepository: PhotoRepository,
    private readonly kakaoService: KakaoService,
    private readonly userRepository: UserRepository,
  ) {}
  async getWorldcupList(userId: string) {
    try {
      const results = await this.photoRepository.getPhotosByUserId(userId);

      const photoIds = results.map((p) => p.id);

      // 1) 투표 수
      const votes = await this.db
        .selectFrom('worldcup_votes')
        .where('name', 'is not', null)
        .where('photo_id', 'in', photoIds)
        .select(['photo_id'])
        .execute();

      const voteCountByPhotoId = votes.reduce<Record<number, number>>(
        (acc, vote) => {
          acc[vote.photo_id] = (acc[vote.photo_id] ?? 0) + 1;
          return acc;
        },
        {},
      );

      // 2) 공유 여부 ✅ (존재 여부만 필요하니 photo_id만 뽑아서 Set으로)
      let sharedPhotoIdSet = new Set<number>();

      if (photoIds.length > 0) {
        const shareRows = await this.db
          .selectFrom('photo_share_code as psc')
          // ✅ 이 컬럼이 “공유된 원본 사진 id”인지 확인 필요
          .where('psc.photo_id', 'in', photoIds)
          // (선택) 만약 공유 기록이 유저별이면 아래도 추가
          // .where('psc.user_id', '=', userId)
          .select(['psc.photo_id'])
          .execute();

        sharedPhotoIdSet = new Set(shareRows.map((r) => r.photo_id));
      }

      // 3) 합치기: voteCount + didShareWorldcup
      const photosWithVoteCount = results.map((photo) => ({
        ...photo,
        voteCount: voteCountByPhotoId[photo.id] ?? 0,
        didShareWorldcup: sharedPhotoIdSet.has(photo.id),
      }));

      const user = await this.userRepository.getUser(userId);

      return {
        status: HttpStatus.OK,
        results: photosWithVoteCount,
        user,
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

      const nullNameCount = votes.filter((v) => v.name != null).length;
      if (nullNameCount === 0) {
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
              results: null,
              my: mySelectPhoto,
            };
          }
        }
        return {
          status: HttpStatus.OK,
          results: null,
        };
      }
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
      const totalVoteCount = photoResultsWithNames.reduce(
        (sum, r) => sum + r.voteCount,
        0,
      );

      const photoResultsWithPercent = photoResultsWithNames.map((r) => {
        const percent =
          totalVoteCount === 0 ? 0 : (r.voteCount / totalVoteCount) * 100;

        return {
          ...r,
          percent,
        };
      });
      const sortedPhotoResults = [...photoResultsWithPercent].sort((a, b) => {
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return a.resultId - b.resultId;
      });
      const mySelect = votes.find(
        (vote) => vote.name == null && vote.user_id == userId,
      );
      //내가 월드컵 결과 페이지에 접속했을 때, 추가하기
      await this.accessWorldCupLog(photoId, userId);
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

      //월드컵 결과 투표할 때. LOG 추가
      //내 사진이 아닌 경우에만 log 추가
      //내 사진인 경우에는 log 추가하지 않음.
      if (photo.user_id !== userId) {
        await this.setLogWorldCupVote(photo.id, photo.user_id);
      }

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
  //월드컵 투표했을 때, 추가하기
  async setLogWorldCupVote(photoId?: number, userId?: string) {
    try {
      const log = await this.db
        .selectFrom('worldcup_log')
        .where('photo_id', '=', photoId)
        .selectAll()
        .executeTakeFirst();
      if (!log) {
        //없으면 추가
        await this.db
          .insertInto('worldcup_log')
          .values({
            photo_id: photoId,
            user_id: userId,
            first_vote_at: new Date(),
            last_vote_at: new Date(),
          })
          .execute();
        //해당 월드컵에 처음 투표하는 경우라면 알림톡 발송
        this.sendKakaoFirstVote(photoId);
      } else if (log != null && log.first_vote_at !== null) {
        //로그가 있는 상태
        //n번째 투표한 사람이라면
        await this.db
          .updateTable('worldcup_log')
          .where('id', '=', log.id)
          .set({
            last_vote_at: new Date(),
          })
          .execute();
      }
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  //월드컵 결과 페이지에 접속했을 때, 추가하기
  async accessWorldCupLog(photoId?: number, userId?: string) {
    try {
      const log = await this.db
        .selectFrom('worldcup_log')
        .where('photo_id', '=', photoId)
        .where('user_id', '=', userId)
        .selectAll()
        .executeTakeFirst();
      if (!!log) {
        //있으면 시간 업데이트
        await this.db
          .updateTable('worldcup_log')
          .where('id', '=', log.id)
          .set({
            accessed_at: new Date(),
          })
          .execute();
        return {
          status: HttpStatus.OK,
        };
      } else {
        return {
          status: HttpStatus.OK,
        };
      }
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async sendKakaoFirstVote(photoId: number) {
    const user = await this.db
      .selectFrom('photos')
      .where('id', '=', photoId)
      .select('user_id')
      .executeTakeFirst();
    if (!user) {
      return;
    }
    let token: string;
    let exists = true;

    while (exists) {
      token = await generateCode(12);

      const found = await this.db
        .selectFrom('token')
        .select('id')
        .where('token', '=', token)
        .executeTakeFirst();

      exists = !!found;
    }
    const now = new Date();
    const expireTime = new Date(now.getTime() + 24 * 60 * 60000);

    await this.db
      .insertInto('token')
      .values({
        user_id: user.user_id,
        token,
        created_at: now,
        expired_at: expireTime,
      })
      .executeTakeFirst();

    await this.kakaoService.sendKakaoNotification(
      user.user_id,
      'pr_cplt_wrc_test', //테스트용 템플릿 임시 추가
      null,
      [],
      [token, photoId.toString()],
    );
  }
}
