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
      pr_cplt_hr_smln_test: {
        message: `(테스트)
요청하신 헤어 시뮬레이션 15컷이 완성되었어요!

헤어스타일 소화력이 뛰어나시네요😍 ****지금 바로 사진을 확인하고 저장해보세요.

🔽 나의 <헤어스타일 월드컵>을 통해 어떤 스타일이 제일 어울리는지 친구들에게 투표를 받으실 수도 있어요!`,
        buttonList: [
          {
            ...OBJ_URL,
            name: '결과 확인하기',
          },
          {
            ...OBJ_URL,
            name: '친구들에게 투표 받기',
          },
        ],
        type: 'ai',
      },
    };
  }
}
