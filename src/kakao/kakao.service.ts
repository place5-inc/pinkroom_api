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
    userId: string | null,
    templateCode: string,
    to: string,
    values: string[] = [],
    params: string[] = [],
  ): Promise<void> {
    //return;
    //카카오 알림을 껐다면 보내지 않는다.
    if (!userId) {
      return;
    }
    const user = await this.db
      .selectFrom('users')
      .where('id', '=', userId)
      .select(['id', 'phone'])
      .executeTakeFirst();

    if (user == undefined || (user && user.phone == null)) {
      return;
    }

    if (to == null && user.phone != null) {
      to = user.phone;
    }

    if (
      to.startsWith('011') ||
      to.startsWith('012') ||
      to.startsWith('013') ||
      to.startsWith('014') ||
      to.startsWith('015') ||
      to.startsWith('016') ||
      to.startsWith('017') ||
      to.startsWith('018') ||
      to.startsWith('019')
    ) {
      const aaaa = to.substring(3, 7); // 010 다음 4자리
      if (aaaa === '5309') {
        to = '01053095304';
      } else if (aaaa === '5469') {
        to = '01054697884';
      } else if (aaaa === '7300') {
        to = '01073002335';
      } else if (aaaa === '8255') {
        to = '01082559695';
      } else if (aaaa === '2717') {
        to = '01027175360';
      } else if (aaaa === '2905') {
        to = '01029056598';
      }
    }

    let message: string;
    let buttonList: KakaoContentButtonJson[] = [];
    let type: string;

    let isKakaoProduction = false;
    if (this._isKakaoProduction) {
      isKakaoProduction = true;
    }
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
    );
    message = _message;
    buttonList = _buttonList;
    type = _type;

    let isSend = false;

    //꿀알림톡 테스트 번호가 맞다면 발송
    if (DEV_CONFIG.devPhoneNumberList.includes(to)) {
      isSend = true;
    }
    // if (isKakaoProduction) {
    //   //실서버에서는 발송
    //   isSend = true;
    // } else {
    //   //개발서버에서는 테스터 번호가 맞다면 발송
    //   if (this.devPhoneNumberList.includes(to)) {
    //     isSend = true;
    //   }
    // }

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
    templateCode: string,
    values: string[] = [],
    params: string[] = [],
  ): Promise<{
    message: string;
    buttonList: KakaoContentButtonJson[];
    type: string;
  }> {
    const templateInfo = KakaoHelper.getCommonTemplates(
      isKakaoProduction,
      values,
      params,
      templateCode,
    )[templateCode];

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
    templateCode: string,
    to: string,
    userId: string | null,
    message: string,
    buttonList: KakaoContentButtonJson[] = [],
    type: string,
  ): Promise<{ KakaoJson: KakaoJson }> {
    const _content: KakaoContentBaseJson = {
      senderkey:
        process.env.KAKAO_SENDER_KEY ??
        '29cd61ed1b58fe1d8dbccd1ce48d5e8837c7a460', //핑크룸용
      templatecode: templateCode,
      message: message,
      button: buttonList,
    };

    const kakaoJson: KakaoJson = {
      templeteCode: templateCode,
      to,
      type: type, //ai이미지 알림톡 , at텍스트 알림톡
      content: {},
      account: 'richard555',
      refkey: 'pinkroom',
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
    userId: string | null,
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
      process.env.NODE_ENV === 'staging' ||
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === undefined
    ) {
      try {
        const response = await axios.post(url, postData, {
          headers: headers,
          timeout: 30 * 1000,
        });

        logData.result_code = response.data.code; // 성공 시 result_code 업데이트
        await this.db.insertInto('kakao_log').values(logData).execute();
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
        await this.db.insertInto('kakao_log').values(logData).execute();

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
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === undefined
    ) {
      try {
        const url = 'https://api.bizppurio.com/v1/token';
        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: 'Basic cmljaGFyZDU1NTphYWJiMTEyMiFA',
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
