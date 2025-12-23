export const KakaoConstants = {
  BASE_URL: process.env.WEB_HOST ?? 'https://marry.kim',
  TEST_URL:
    'https://marrykim-web-alpha-ctd5gqd7gxcxcjef.koreacentral-01.azurewebsites.net',
};

export class KakaoHelper {
  static getCommonTemplates(
    isKakaoProduction: boolean,
    values: string[] = [],
    params: string[] = [],
    templatecode: string,
    i: string | null,
    k: string | null,
  ) {
    let BASE_PARAMS = `code=${templatecode}&i=${i}&k=${k}`;

    let URL = `${KakaoConstants.BASE_URL}/kakao-auth?${BASE_PARAMS}`;

    if (!isKakaoProduction) {
      URL = `${KakaoConstants.TEST_URL}/kakao-auth?${BASE_PARAMS}`;
    }

    const OBJ_URL = {
      url_pc: URL,
      url_mobile: URL,
      type: 'WL',
    };

    return {
      mk_001: {
        message: `${values[0]}님이 생각하는 소개받고 싶은 사람의 조건이 있나요?\n\n${values[0]}님의 회원가입 정보를 확인할 동안 원하시는 소개팅 조건을 알려주세요! 주선자 킴이 첫 소개팅을 주선할 때 참고할게요!\n\n*이 메시지는 고객님이 신청하신 소개팅 알림 설정에 따라, 소개팅 시 필요한 정보를 요청하기 위한 메시지입니다.`,
        buttonList: [
          {
            ...OBJ_URL,
            name: '소개팅 조건 입력하기',
          },
        ],
        type: 'ai',
      },
    };
  }
}
