export const KakaoConstants = {
  BASE_URL: process.env.WEB_HOST ?? 'https://pinkroom.ai',
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
      templateCode === 'pr_cplt_hr_smln_v2' ||
      templateCode === 'pr_cplt_wrc_test' ||
      templateCode === 'pr_cplt_wrc_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_week_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_month_v1' ||
      templateCode === 'pr_cplt_wrc_rmd_week_test' ||
      templateCode === 'pr_cplt_wrc_rmd_month_test'
    ) {
      BASE_PARAMS = `s/result/${params[0]}/${params[1]}`;
      if (
        templateCode === 'pr_cplt_wrc_test' ||
        templateCode === 'pr_cplt_wrc_v1'
      ) {
        BASE_PARAMS = `w/result/${params[0]}/${params[1]}`;
      }
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
      test_02: {
        message: `(테스트)

핑크룸입니다. ${values[0]}
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
        message: `요청하신 헤어 시뮬레이션 사진 16개가 모두 완성되었어요!

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
      pr_cplt_hr_smln_v2: {
        message: `요청하신 헤어 시뮬레이션 사진 16개가 모두 완성되었어요!

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

앞으로도 친구들이 뽑은 내 16개 헤어스타일 랭킹은 [헤어스타일 월드컵 결과보기] 버튼을 눌러 확인하실 수 있어요.`,
        buttonList: [
          {
            ...OBJ_BUTTON_URL_DEFAULT,
            name: '헤어스타일 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어스타일 월드컵 공유하기',
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
            name: '헤어스타일 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어스타일 월드컵 공유하기',
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
            name: '헤어스타일 월드컵 결과보기',
          },
          {
            ...OBJ_BUTTON_URL_2,
            name: '헤어스타일 월드컵 공유하기',
          },
        ],
        type: 'ai',
      },
      pr_fail_fst_pt: {
        message: `현재 이용자가 너무 많아, AI 미용사가 ${values[0]} 사진을 제작하지 못했어요😭
불편을 드려 죄송합니다.

이 채팅창으로 문의해주시면 가장 먼저 해결해드릴게요! 가입하신 휴대폰번호를 남겨주시면 더 빨리 확인해드릴 수 있습니다!`,
        type: 'ai',
      },
      pr_fail_any_pt: {
        message: `현재 이용자가 너무 많아, AI 미용사가 미처 제작하지 못한 헤어 합성 사진이 있어요 😭
많이 기다리셨을 텐데 정말 죄송합니다.

이 채팅창으로 문의해주시면 가장 먼저 해결해드릴게요! 가입하신 휴대폰번호를 남겨주시면 더 빨리 확인해드릴 수 있습니다.`,
        type: 'ai',
      },
      pr_fail_pt_rst: {
        message: `현재 이용자가 너무 많아, AI 미용사가 한 분 한 분 정성껏 사진을 만드느라 시간이 조금 더 걸리고 있어요🥲
불편을 드려 죄송합니다.

16개 헤어스타일 사진이 모두 완성되는대로 알림톡을 보내드릴게요!
조금만 더 기다려주시면 감사하겠습니다🙏

관련하여 문의사항이 있으시면 이 채팅창에 남겨주세요!`,
        type: 'ai',
      },
      pr_wlcm_snup_v1: {
        message: `안녕하세요!
AI 뷰티 시뮬레이션 서비스, 핑크룸에 오신 것을 환영합니다.
고객님의 스타일링을 도와드리게 되어 기뻐요💗

채팅방 하단의 [AI 헤어 합성] 메뉴를 눌러 언제든 핑크룸에 접속하실 수 있습니다!`,
        type: 'ai',
      },
    };
  }
}
