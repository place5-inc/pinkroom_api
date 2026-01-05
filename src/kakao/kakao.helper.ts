export const KakaoConstants = {
  BASE_URL: process.env.WEB_HOST ?? 'https://www.pinkroom.ai',
  TEST_URL:
    'https://pinkroom-web-development-h3e5gjf7h6fpedfh.koreacentral-01.azurewebsites.net',
};

export class KakaoHelper {
  static getCommonTemplates(
    isKakaoProduction: boolean,
    values: string[] = [],
    params: string[] = [],
    templateCode: string,
  ) {
    let BASE_PARAMS = ``;
    let BASE_PARAMS_2 = ``;

    if (
      templateCode === 'pr_cplt_hr_smln_test' ||
      templateCode === 'pr_cplt_hr_smln_v1' ||
      templateCode === 'pr_cplt_wrc_test' ||
      templateCode === 'pr_cplt_wrc_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_week_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_month_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_week_test' ||
      templateCode === 'pr_cplt_wrc_rmd_month_test'
    ) {
      BASE_PARAMS = `s/result/${params[0]}/${params[1]}`;
      BASE_PARAMS_2 = `w/result/${params[0]}/${params[1]}`;
    }

    let URL_DEFAULT = `${KakaoConstants.BASE_URL}/${BASE_PARAMS}`;
    let URL_2 = `${KakaoConstants.BASE_URL}/${BASE_PARAMS_2}`;

    if (!isKakaoProduction) {
      URL_DEFAULT = `${KakaoConstants.TEST_URL}/${BASE_PARAMS}`;
      URL_2 = `${KakaoConstants.TEST_URL}/${BASE_PARAMS_2}`;
    }

    const OBJ_BUTTON_URL_DEFAULT = {
      url_pc: URL_DEFAULT,
      url_mobile: URL_DEFAULT,
      type: 'WL',
    };

    const OBJ_BUTTON_URL_2 = {
      url_pc: URL_2,
      url_mobile: URL_2,
      type: 'WL',
    };

    return {
      test_01: {
        message: `(테스트)핑크룸입니다.
감사합니다.`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
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
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '결과 확인하기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '친구들에게 투표 받기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_hr_smln_v1: {
        message: `요청하신 헤어 시뮬레이션 15컷이 완성되었어요!

헤어스타일 소화력이 뛰어나시네요😍
지금 바로 사진을 확인하고 저장해보세요.

🔽 나의 <헤어스타일 월드컵>을 통해 어떤 스타일이 제일 어울리는지 친구들에게 투표를 받으실 수도 있어요!`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '결과 확인하기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '친구들에게 투표 받기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_test: {
        message: `(테스트)
처음으로 친구가 내 헤어스타일 월드컵에 참여했어요!
친구가 뽑아준 나의 베스트 헤어스타일을 확인해보세요.

앞으로도 친구들이 뽑은 내 16개 헤어스타일 랭킹은 [헤어 월드컵 결과보기] 버튼을 눌러 확인하실 수 있어요.`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_v1: {
        message: `처음으로 친구가 내 헤어스타일 월드컵에 참여했어요!
친구가 뽑아준 나의 베스트 헤어스타일을 확인해보세요.

앞으로도 친구들이 뽑은 내 16개 헤어스타일 랭킹은 [헤어 월드컵 결과보기] 버튼을 눌러 확인하실 수 있어요.`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_rmd_week_test: {
        message: `(테스트)
누군가가 내 헤어스타일 월드컵에 참여했어요!

나의 베스트 헤어스타일 투표 1위가 바뀌었을지도 몰라요 👀

지금 바로 확인해보세요!`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_rmd_month_test: {
        message: `(테스트)
누군가가 내 헤어스타일 월드컵에 참여했어요!

나의 베스트 헤어스타일 투표 1위가 바뀌었을지도 몰라요 👀

지금 바로 확인해보세요!`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_rmd_week_v1: {
        message: `누군가가 내 헤어스타일 월드컵에 참여했어요!

나의 베스트 헤어스타일 투표 1위가 바뀌었을지도 몰라요 👀

지금 바로 확인해보세요!`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_cplt_wrc_rmd_month_v1: {
        message: `누군가가 내 헤어스타일 월드컵에 참여했어요!

나의 베스트 헤어스타일 투표 1위가 바뀌었을지도 몰라요 👀

지금 바로 확인해보세요!`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
    };
  }
}
