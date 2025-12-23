import {
  Injectable,
  BadRequestException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import axios from 'axios';
import { DateTime } from 'luxon';
import { DatabaseProvider } from 'src/libs/db';
import { encrypt } from 'src/libs/helpers';
import {
  KakaoJson,
  KakaoContentButtonJson,
  KakaoContentBaseJson,
  DEV_CONFIG,
} from 'src/libs/types'; // 필요한 타입 임포트
import { SendKaKaoNewGetTokenModel } from 'src/libs/types';
import { NIL } from 'uuid';
import { KakaoHelper } from './kakao.helper';

@Injectable()
export class KakaoService {
  constructor(private readonly db: DatabaseProvider) {}
  private readonly _isKakaoProduction = DEV_CONFIG.isKakaoProduction;
  private readonly devPhoneNumberList = DEV_CONFIG.devPhoneNumberList;

  // 카카오 알림톡 전송
  async sendKakaoNotification(
    isKakaoProduction: boolean = false,
    userId: number | null,
    templateCode: string,
    to: string,
    values: string[] = [],
    params: string[] = [],
  ): Promise<void> {
    //카카오 알림을 껐다면 보내지 않는다.
    if (userId) {
      const user = await this.db
        .selectFrom('users')
        .where('id', '=', userId)
        .select('phone')
        .executeTakeFirst();

      if (user! || (user && user.phone == null)) {
        return;
      }
    }

    let [i, k] = [null, null];
    if (userId) {
      [i, k] = encrypt(userId.toString());
    }

    let message: string;
    let buttonList: KakaoContentButtonJson[] = [];
    let type: string;

    // 런칭용
    const {
      message: _message,
      buttonList: _buttonList,
      type: _type,
    } = await this.getKakaoTemplateInfo(
      isKakaoProduction,
      templateCode,
      values,
      params,
      i,
      k,
    );
    message = _message;
    buttonList = _buttonList;
    type = _type;

    let isSend = false;

    if (isSend) {
      // KakaoJson 객체 생성하기
      const kakaoJson = await this.KakaoJson(
        templateCode,
        to,
        userId || null,
        message,
        buttonList,
        type,
      );
      // 카카오 메시지 전송하기
      await this.sendKakao(userId || null, kakaoJson.KakaoJson, to);
    }
  }

  // 실제 런칭용 getKakaoTemplateInfo 함수
  async getKakaoTemplateInfo(
    isKakaoProduction: boolean = false,
    templatecode: string,
    values: string[] = [],
    params: string[] = [],
    i: string | null,
    k: string | null,
  ): Promise<{
    message: string;
    buttonList: KakaoContentButtonJson[];
    type: string;
  }> {
    const templateInfo = KakaoHelper.getCommonTemplates(
      isKakaoProduction,
      values,
      params,
      templatecode,
      i,
      k,
    )[templatecode];

    if (!templateInfo) {
      throw new BadRequestException('유효하지 않은 템플릿 코드입니다.');
    }

    return {
      message: templateInfo.message,
      buttonList: templateInfo.buttonList || [],
      type: templateInfo.type,
    };
  }

  async KakaoJson(
    templatecode: string,
    to: string,
    userId: number | null,
    message: string,
    buttonList: KakaoContentButtonJson[] = [],
    type: string,
  ): Promise<{ KakaoJson: KakaoJson }> {
    const _content: KakaoContentBaseJson = {
      senderkey: '863844ca56c8013f6760403bf9737cfd13d21637', //김결혼용
      templatecode: templatecode,
      message: message,
      button: buttonList,
    };

    let [i, k] = [null, null];

    if (userId) {
      [i, k] = encrypt(userId.toString());
    }

    const kakaoJson: KakaoJson = {
      templeteCode: templatecode,
      to,
      i,
      k,
      type: type, //ai이미지 알림톡 , at텍스트 알림톡
      content: {},
      account: 'richard555',
      refkey: 'kim',
      from: '01045209089',
    };

    if (type === 'at') {
      kakaoJson.content.at = _content;
      kakaoJson.content.ai = null;
    } else if (type === 'ai') {
      kakaoJson.content.ai = _content;
      kakaoJson.content.at = null;
    }

    return { KakaoJson: kakaoJson }; // KakaoJson 객체를 반환합니다.
  }

  // 카카오 메시지 전송하기
  async sendKakao(
    userId: number | null,
    value: KakaoJson,
    to: string,
  ): Promise<{ status: number; data: { message: string } }> {
    value.to = to;

    const postData = JSON.stringify(value);

    // 토큰 가져오기
    const token = await this.getKakaoToken();

    if (!token || !token.result) {
      throw new BadRequestException('Kakao token을 가져오는 데 실패했습니다.');
    }

    const url = 'https://api.bizppurio.com/v3/message';
    const headers = {
      'Content-type': 'application/json; charset=utf-8',
      Authorization: `${token.result.type} ${token.result.accesstoken}`,
    };

    const logData = {
      user_id: userId || NIL,
      phone_number: to,
      template_code: value.templeteCode,
      created_at: DateTime.now().toJSDate(),
      json: postData,
      result_code: null, // 초기값 설정
      exception_message: null, // 초기값 설정
    };
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging'
    ) {
      try {
        const response = await axios.post(url, postData, {
          headers: headers,
          timeout: 30 * 1000,
        });

        logData.result_code = response.data.code; // 성공 시 result_code 업데이트
        //await this.db.insertInto('kakao_log').values(logData).execute();
        return {
          status: HttpStatus.OK,
          data: {
            message: response.data.description,
          },
        };
      } catch (error: any) {
        logData.result_code = error.response?.data?.code; // 실패 시 result_code 업데이트
        logData.exception_message =
          error.response?.data?.description || error.message; // 실패 시 exception_message 업데이트
        //await this.db.insertInto('kakao_log').values(logData).execute();

        throw new HttpException(
          `카카오 메시지 전송 실패: ${error.response?.data?.description || error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async getKakaoToken(): Promise<{
    isSuccess: boolean;
    message: string;
    result: SendKaKaoNewGetTokenModel | null;
  }> {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging' ||
      process.env.NODE_ENV === undefined
    ) {
      try {
        const url = 'https://api.bizppurio.com/v1/token';
        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: 'Basic cmljaGFyZDU1MTU6QWFiYjExMjIh',
        };
        const response = await axios.post(url, {}, { headers, timeout: 30000 });
        const data = response.data;

        const result: SendKaKaoNewGetTokenModel = {
          accesstoken: data.accesstoken,
          type: data.type,
          expired: data.expired,
        };
        return {
          isSuccess: true,
          message: '',
          result,
        };
      } catch (error: any) {
        throw new HttpException(
          `카카오 토큰 가져오기 실패: ${error.message || 'Unknown error'}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return {
      isSuccess: true,
      message: 'success',
      result: {
        accesstoken: '',
        type: '',
        expired: '',
      },
    };
  }
}
