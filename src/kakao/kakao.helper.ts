export const KakaoConstants = {
  BASE_URL:
    process.env.WEB_HOST ??
    'https://pinkroom-web-brgrgydgc5a8ctc4.koreacentral-01.azurewebsites.net',
  TEST_URL:
    'https://pinkroom-web-development-h3e5gjf7h6fpedfh.koreacentral-01.azurewebsites.net',
};

export class KakaoHelper {
  static getCommonTemplates(
    isKakaoProduction: boolean,
    values: string[] = [],
    params: string[] = [],
    templateCode: string,
    i: string | null,
    k: string | null,
  ) {
    let BASE_PARAMS = `code=${templateCode}&i=${i}&k=${k}`;

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
      test_01: {
        message: `(테스트)핑크룸입니다.
감사합니다.`,
        buttonList: [
          {
            ...OBJ_URL,
            name: '바로가기',
          },
        ],
        type: 'at',
      },
    };
  }
}
