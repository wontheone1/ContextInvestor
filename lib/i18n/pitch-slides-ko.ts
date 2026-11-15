/**
 * ============================================================================
 * FILE: lib/i18n/pitch-slides-ko.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Korean ('ko') localization for all 10 slides of the Contextual Investing
 * Hackathon Pitch Deck, including titles, subtitles, analogies, key proof
 * points, plain-Korean financial term guides, and 3-minute presenter scripts.
 *
 * USE CASES:
 * 1. Presenting or reading the 10-slide interactive Pitch Deck in Korean when
 *    `locale === 'ko'`.
 * 2. Exporting a localized Korean `.pptx` PowerPoint deck or printable PDF
 *    when the presenter switches the UI language to `한국어`.
 * ============================================================================
 */

import type { AppLocale } from './types';

export interface PitchSlideTranslatableFields {
  index: number;
  sectionKicker: string;
  title: string;
  subtitle: string;
  screenshotCaption: string;
  analogyTitle: string;
  analogyText: string;
  keyPoints: Array<{
    heading: string;
    detail: string;
  }>;
  jargonTranslator: Array<{
    term: string;
    plainMeaning: string;
  }>;
  speakerScript: string;
  demoActionLabel: string;
}

export const HACKATHON_SLIDES_KO: Record<number, Omit<PitchSlideTranslatableFields, 'index'>> = {
  0: {
    sectionKicker: '01. 해커톤 피치 · 인트로',
    title: 'Contextual Investing: 기업을 움직이는 보이지 않는 도미노 체인을 한눈에',
    subtitle:
      '흩어진 글로벌 다국어 뉴스, 공급망 관계, 실시간 시장 데이터를 누구나 몇 초 만에 검증할 수 있는 명쾌한 인사이트로 연결합니다.',
    screenshotCaption:
      '실시간 Contextual Investing 워크스페이스 — NVIDIA(NVDA) 주가 흐름, 핵심 투자지표 및 원클릭 관심종목 팔로우.',
    analogyTitle: '핵심 아이디어를 한 문장으로',
    analogyText:
      '어떤 기업도 혼자 움직이지 않습니다 — 관심 있는 기업을 실시간 모니터링하고, 공급사와 고객사 생태계를 매핑하며, 왜 오늘 뉴스가 중요한지 알기 쉽게 설명해 주는 웹 인텔리전스 터미널입니다.',
    keyPoints: [
      {
        heading: '어려운 월가 전문용어 대신 명쾌한 인과관계',
        detail:
          '복잡한 시장 변동을 "무슨 일이 일어났는가"와 "왜 중요한가"로 정리하고 원문 뉴스 링크로 즉시 검증합니다.',
      },
      {
        heading: 'Context.dev + Gemini 구조화 추론의 결합',
        detail:
          '실시간 글로벌 뉴스 검색, 기업 개요 데이터, 실시간 주가·ADR 시세, 공급망 밸류체인을 한 화면에 통합했습니다.',
      },
      {
        heading: '어디서나 원클릭 관심종목(Watchlist) 큐레이션',
        detail:
          '검색한 기업, 공급망 파트너, 자연어 스크리닝 결과 어디서든 원클릭으로 팔로우하여 나만의 포트폴리오를 추적합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '상장 기업 vs. 비상장 유니콘',
        plainMeaning:
          '상장 기업(NVIDIA, Apple 등)은 증시에서 실시간으로 주식이 거래되며, 비상장 유니콘(OpenAI, Stripe 등)은 투자 유치 라운드 기준으로 기업가치가 평가됩니다.',
      },
      {
        term: '관심종목 (Watchlist)',
        plainMeaning:
          '주요 뉴스와 가격 변동을 24시간 놓치지 않도록 등록해 두는 나만의 핵심 관심 기업 목록입니다.',
      },
    ],
    speakerScript:
      '안녕하세요! 주식을 직접 거래하지 않더라도 NVIDIA, Apple, OpenAI 같은 기업이 경제를 움직인다는 사실은 누구나 압니다. 하지만 특정 기업이 오늘 왜 급등하거나 급락하는지 파악하려면 수많은 탭을 오가야 합니다. 저희가 만든 Contextual Investing은 실시간 글로벌 뉴스, 공급망, 시장 데이터를 한데 연결해 누구나 이해할 수 있는 언어로 답을 제시하는 인텔리전스 워크스페이스입니다.',
    demoActionLabel: '실시간 NVIDIA 워크스페이스 열기',
  },
  1: {
    sectionKicker: '02. 일상의 문제점 · 기존 도구들의 한계',
    title: '회사는 아무 발표도 안 했는데 왜 내 주식이 5%나 빠졌을까?',
    subtitle:
      '오늘날 가장 큰 주가 변동은 기업 내부가 아니라 공급사 공장, 주요 고객사의 예산 변화, 또는 밤사이 해외 속보에서 먼저 시작되기 때문입니다.',
    screenshotCaption:
      '도미노 파급 효과: 대만 TSMC나 한국 SK하이닉스의 밤사이 공정 뉴스가 곧바로 NVIDIA와 Microsoft에 직결됩니다.',
    analogyTitle: '일상 비유: 동네 인기 카페의 도미노 체인',
    analogyText:
      '인기 있는 카페를 운영한다고 상상해 보세요. 매장이 아무리 장사를 잘해도 콜롬비아 원두 농장에 서리가 내리거나 에스프레소 머신 부품이 품절되면 당장 내일 매출이 흔들립니다. 글로벌 상장 기업도 똑같이 움직입니다.',
    keyPoints: [
      {
        heading: '1. "브라우저 탭 10개 열기"의 피로감',
        detail:
          '차트 탭, 뉴스 사이트 3곳, 누가 누구에게 납품하는지 찾는 검색창, 스프레드시트를 일일이 오가야 합니다.',
      },
      {
        heading: '2. 기업 간 숨겨진 공급망 연쇄 반응',
        detail:
          'NVIDIA만 봐서는 TSMC가 칩을 위탁 생산하고, SK하이닉스가 HBM 메모리를 공급하며, Microsoft가 서버를 사간다는 맥락을 놓칩니다.',
      },
      {
        heading: '3. 외국어 속보 사각지대와 클릭베이트 노이즈',
        detail:
          '핵심 공급망 속보는 미국 언론보다 한국어, 일본어, 독일어 매체에서 몇 시간 먼저 보도되는 경우가 많습니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '공급망 파급 효과 (Supply-Chain Ripple)',
        plainMeaning:
          '부품 공급사(예: 반도체 파운드리)의 병목이나 기술 돌파구가 이를 의존하는 전방 기업들에 연쇄적으로 미치는 영향입니다.',
      },
      {
        term: '시그널 vs. 노이즈 (Signal vs. Noise)',
        plainMeaning:
          '반복되는 50개의 단순 가십 기사 속에서 실제 기업 실적을 바꿀 핵심 기사 2건을 가려내는 일입니다.',
      },
    ],
    speakerScript:
      '많은 투자자가 겪는 실제 상황입니다. 아침에 일어나 보니 NVIDIA가 아무 공시도 없었는데 크게 흔들립니다. 왜일까요? 밤사이 대만의 파운드리 파트너나 한국의 메모리 공급사에서 중요한 발표가 나왔기 때문입니다. 지금까지는 이 연결고리를 찾으려면 열 개의 브라우저 탭을 띄우고 몇 시간씩 직접 뒤져야 했습니다.',
    demoActionLabel: '실시간 NVIDIA 공급망 생태계 보기',
  },
  2: {
    sectionKicker: '03. 우리의 솔루션 · 작동 방식',
    title: '웹 전체를 감시하고 맥락의 점을 이어주는 단 하나의 워크스페이스',
    subtitle:
      '30초 만에 읽는 일일 브리핑부터 원클릭 공급망 탐색과 자연어 비교 분석까지 한 화면에서 매끄럽게 이어집니다.',
    screenshotCaption:
      '관심종목 통합 일일 브리핑부터 원클릭 공급망 피벗 및 자연어 코호트 스크리닝까지 통합 제공.',
    analogyTitle: '처음 방문한 사용자의 4단계 경험',
    analogyText:
      '복잡한 재무 공식을 몰라도 바로 시작할 수 있습니다: (1) 아는 기업 팔로우, (2) 일일 브리핑 확인, (3) 공급사·경쟁사 원클릭 탐색, (4) 일상 문장으로 질문하기.',
    keyPoints: [
      {
        heading: '01. 관심종목 통합 일일 브리핑 (Daily Brief)',
        detail:
          '팔로우 중인 모든 기업의 오늘 핵심 이슈를 강세 호재와 주의해야 할 리스크로 나누어 한눈에 요약합니다.',
      },
      {
        heading: '02. 인터랙티브 공급망 생태계 & 원클릭 팔로우',
        detail:
          '모든 기업의 공급사, 고객사, 경쟁사, 파트너를 자동 매핑하고 각 카드에서 즉시 팔로우할 수 있습니다.',
      },
      {
        heading: '03. 자연어 코호트 비교 & AI 리서치 드로어',
        detail:
          '"시가총액 2000억 달러 이상 AI 반도체 기업"처럼 문장으로 검색하거나 우측 AI 드로어에서 출처 기반 답변을 얻습니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '강세 모멘텀 / 호재 (Bullish Catalyst)',
        plainMeaning:
          '신제품 출시, 대규모 수주, 공장 증설 등 기업의 성장과 주가에 긍정적 동력이 되는 실제 사건입니다.',
      },
      {
        term: '약세 리스크 / 역풍 (Bearish Headwind)',
        plainMeaning:
          '부품 부족, 규제 조사, 경쟁 심화 등 기업 성장을 둔화시킬 수 있는 주의 요인입니다.',
      },
    ],
    speakerScript:
      'Contextual Investing은 네 가지 핵심 워크플로우를 하나의 깔끔한 화면에 담았습니다. 포트폴리오 전체를 요약하는 일일 브리핑, 공급사와 고객사를 보여주는 생태계 맵, 티커를 몰라도 되는 자연어 검색창, 그리고 출처를 검증해 주는 AI 애널리스트 드로어입니다.',
    demoActionLabel: '실시간 일일 브리핑 열기',
  },
  3: {
    sectionKicker: '04. Act 1 · 실시간 웹 감시 (일일 브리핑)',
    title: '"오늘 무슨 일이 있었고 왜 중요한가"에 대한 즉각적인 해답',
    subtitle:
      '정렬되지 않은 50개의 기사를 스크롤하는 대신, 내 관심 기업 전체에서 가장 확신도 높은 상승 호재와 하락 리스크를 바로 확인하세요.',
    screenshotCaption:
      '관심종목 일일 브리핑: 포트폴리오 통합 핵심 요약 + 핵심 강세 모멘텀 vs. 약세 리스크 랭킹.',
    analogyTitle: '비전문가도 한눈에 이해하는 이유',
    analogyText:
      '일반 뉴스 피드는 제목만 나열합니다. 일일 브리핑은 각 기사의 실질적 중요도를 1~100% 확신도로 채점하고, 왜 호재인지 혹은 왜 리스크인지 한 문장으로 명확히 풀어줍니다.',
    keyPoints: [
      {
        heading: '관심종목 교차 핵심 요약 (Executive Summary)',
        detail:
          '팔로우 중인 모든 기업의 최신 Context.dev 뉴스를 병렬로 수집해 오늘의 큰 흐름을 3문장으로 요약합니다.',
      },
      {
        heading: '강세 모멘텀 vs. 약세 리스크 나란히 배치',
        detail:
          '긍정적인 돌파구와 경고 신호를 좌우로 분리해 편향 없는 균형 잡힌 시각을 제공합니다.',
      },
      {
        heading: '새 기업 팔로우 즉시 반영되는 반응성',
        detail:
          '미국 상장주, ADR(SK하이닉스, TSMC 등) 또는 비상장 유니콘(OpenAI, Stripe)을 추가하면 브리핑이 즉시 갱신됩니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '확신도 / 중요도 점수 (1–100%)',
        plainMeaning:
          '단순 홍보성 기사를 걸러내고 해당 뉴스가 실제 기업 사업에 얼마나 큰 영향을 주는지 나타내는 지표입니다.',
      },
      {
        term: '기업별 포스처 스트립 (Posture Strip)',
        plainMeaning:
          '팔로우한 각 기업의 오늘 뉴스 분위기가 긍정적(강세), 부정적(약세), 혼조 중 어디에 가까운지 보여주는 한 줄 기상도입니다.',
      },
    ],
    speakerScript:
      'Act 1은 실시간 일일 브리핑입니다. 일일 브리핑을 열면 팔로우 중인 모든 기업에 대해 Context.dev 뉴스를 동시에 조회합니다. 상단에는 기업 간 연결 흐름을 요약하고, 하단에는 핵심 호재와 핵심 리스크를 중요도 점수 및 한 줄 근거와 함께 나란히 보여줍니다.',
    demoActionLabel: '일일 브리핑 라이브 실행',
  },
  4: {
    sectionKicker: '05. Act 2 · NVIDIA 공급망 도미노 추적',
    title: '공급사·고객사·경쟁사를 한눈에 매핑하고 원클릭으로 팔로우',
    subtitle:
      '어떤 기업을 검색하든 주변 4대 핵심 관계 그룹을 자동으로 밝혀내어 공급망 연쇄 반응을 한발 앞서 포착합니다.',
    screenshotCaption:
      'NVIDIA 공급망 생태계 패널: 공급사, 고객사, 경쟁사, 전략적 파트너 분류 및 인라인 + 팔로우 버튼.',
    analogyTitle: '실제 작동하는 NVIDIA 공급망 스토리',
    analogyText:
      'NVIDIA를 검색하면 공급망에 TSMC·SK하이닉스, 고객사에 Microsoft·Meta, 경쟁사에 AMD·Broadcom이 즉시 나타납니다. 현재 화면을 벗어나지 않고 바로 "+ 팔로우"를 눌러 관심종목에 담을 수 있습니다.',
    keyPoints: [
      {
        heading: '4대 밸류체인 관계 그룹화',
        detail:
          '공급망 및 인프라, 고객사 및 도입 기업, 동종업계 및 경쟁사, 전략적 파트너로 체계적으로 분류합니다.',
      },
      {
        heading: '다중 역할(Multi-Role) 중복 감지',
        detail:
          'NVIDIA 칩의 대형 고객사이자 자체 AI 칩을 개발하는 경쟁사이기도 한 Microsoft 같은 복합 관계를 명확히 표시합니다.',
      },
      {
        heading: '화면 이탈 없는 원클릭 개별·그룹 팔로우',
        detail:
          '개별 파트너를 팔로우하거나 "+ 상위 4개 팔로우" 버튼으로 공급망 그룹 전체를 한 번에 관심종목에 추가합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '전방 공급사 (Upstream Supplier)',
        plainMeaning:
          '완제품 생산에 필수적인 핵심 부품·장비·공정을 제공하는 기업입니다(예: NVIDIA 웨이퍼를 생산하는 TSMC).',
      },
      {
        term: '후방 고객사 (Downstream Customer)',
        plainMeaning:
          '제품을 대량 구매해 해당 기업의 매출을 견인하는 주요 수요처입니다(예: 데이터센터 GPU를 구매하는 Microsoft Azure).',
      },
    ],
    speakerScript:
      'Act 2에서는 NVIDIA 도미노 효과를 직접 추적해 봅니다. NVIDIA를 조회하면 공급사 TSMC·SK하이닉스, 고객사 Microsoft, 경쟁사 AMD, 파트너 OpenAI까지 네 기둥으로 생태계를 보여줍니다. 모든 카드에 달린 팔로우 버튼으로 미국 상장주와 ADR을 즉시 관심종목에 추가하거나 클릭 한 번으로 분석 대상을 전환할 수 있습니다.',
    demoActionLabel: '실시간 NVIDIA 생태계 탐색',
  },
  5: {
    sectionKicker: '06. Act 3 · 자연어 기업 발굴 및 나란히 비교',
    title: '주식 티커를 모르시나요? 일상 언어로 검색하고 비교하세요',
    subtitle:
      '"시가총액 2000억 달러 이상 AI 반도체 기업"처럼 평소 말하듯 입력하면 조건에 맞는 리더 기업들을 찾아 검증하고 나란히 비교합니다.',
    screenshotCaption:
      '자연어 코호트 스크리너: 자연어 질의 자동 감지, 실시간 시가총액 검증 및 0% 기준 상대 수익률 차트.',
    analogyTitle: '일반 사용자에게 왜 강력한가',
    analogyText:
      'Broadcom의 티커가 AVGO이고 SK하이닉스 미국 ADR이 SKHY라는 걸 외울 필요가 없습니다. 자연스러운 문장으로 검색하면 실제 기업을 찾아 시가총액을 실시간 검증하고 한 화면에서 비교해 줍니다.',
    keyPoints: [
      {
        heading: '단일 검색창 내 자동 의도 감지',
        detail:
          '하나의 검색창에서 티커("NVDA"), 비상장사("Stripe"), 자연어 조건 문장을 모두 자동으로 구분해 처리합니다.',
      },
      {
        heading: '검색 결과 원클릭 팔로우 및 선택 그룹 일괄 팔로우',
        detail:
          '검증된 후보 카드마다 인라인 "+ 팔로우" 버튼과 "+ 선택 기업 일괄 팔로우" 기능을 제공합니다.',
      },
      {
        heading: '공정한 % 상대 수익률 차트 & 4차원 매트릭스',
        detail:
          '선택한 상장 주식들을 기간 시작점 0.00% 기준으로 정규화해 주가 수준이 다른 종목 간 수익률을 공정하게 비교합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '시가총액 (Market Capitalization)',
        plainMeaning:
          '주식시장에서 평가받는 기업의 전체 가치(주가 × 총 발행주식수)입니다. 2,000억 달러 이상이면 글로벌 초대형 리더 기업입니다.',
      },
      {
        term: '정규화 % 차트 (Indexed to 0%)',
        plainMeaning:
          '조회 첫날 모든 기업을 0% 출발선에 맞춰 140달러 주식과 900달러 주식 중 누가 더 빠르게 성장했는지 비교하는 차트입니다.',
      },
    ],
    speakerScript:
      '티커 심볼을 전혀 모른다면 어떨까요? Act 3에서는 검색창에 "AI chip companies with over 200 bn USD market cap"처럼 문장을 입력하면 자동으로 코호트 비교 모드로 전환됩니다. 실제로 2,000억 달러 기준을 통과하는지 실시간 시세를 검증하고, 상대 수익률 차트와 4차원 매트릭스로 나란히 비교해 줍니다.',
    demoActionLabel: '"AI 반도체 > $200B" 비교 실행',
  },
  6: {
    sectionKicker: '07. Act 4 · 초고속 팩트 검증 및 글로벌 다국어 번역',
    title: '모든 이슈의 양면을 균형 있게 — 언어 장벽 없는 원문 검증',
    subtitle:
      '강세 vs. 약세 양면 분석으로 확증 편향을 막고, 해외 현지어 속보를 자동 번역하면서 원문 대조 토글을 함께 제공합니다.',
    screenshotCaption:
      '강세 모멘텀 vs. 약세 리스크 나란히 보기 + 한국어·일본어·독일어 뉴스 자동 번역 및 원문 보기 토글.',
    analogyTitle: '블랙박스 AI 환각 없는 투명한 근거',
    analogyText:
      'AI가 근거 없이 "이 주식을 사라"고만 말한다면 믿어선 안 됩니다. 우리는 긍정 논리와 리스크 논리를 나란히 제시하고, 각 기사의 투자심리 근거와 번역 전 원문을 원클릭으로 공개합니다.',
    keyPoints: [
      {
        heading: '균형 잡힌 강세(Bull) vs. 약세(Bear) 진단 카드',
        detail:
          '성장을 이끄는 긍정적 모멘텀과 주의해야 할 리스크 요인을 나란히 요약한 뒤 종합 투자 의견을 제시합니다.',
      },
      {
        heading: '국경 없는 다국어 뉴스 자동 번역',
        detail:
          '한국어, 일본어, 독일어, 프랑스어, 스페인어, 중국어 보도를 자동 감지해 명쾌하게 번역합니다.',
      },
      {
        heading: '원클릭 "원문 보기" 및 언론사 직접 링크',
        detail:
          '번역된 모든 기사에서 원문 텍스트를 즉시 펼쳐 대조할 수 있으며 언론사 원문 링크로 바로 연결됩니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '강세론(Bull Case) vs. 약세론(Bear Case)',
        plainMeaning:
          '강세론은 기업이 성장할 낙관적 근거이고, 약세론은 성장을 방해할 수 있는 신중한 리스크 시나리오입니다.',
      },
      {
        term: '출처 그라운딩 (Source Grounding)',
        plainMeaning:
          'AI 요약의 모든 문장을 막연한 추측이 아닌 실제 클릭 가능한 뉴스 기사에 직접 연결하는 원칙입니다.',
      },
    ],
    speakerScript:
      'Act 4는 신뢰성과 글로벌 커버리지입니다. 어떤 기업을 분석하든 긍정적 호재와 리스크를 나란히 배치해 한쪽으로 치우친 과장을 막습니다. 또한 한국이나 일본에서 중요한 반도체 속보가 나오면 자동으로 번역해 보여주면서도 원클릭 원문 보기 버튼으로 1차 출처를 투명하게 검증할 수 있습니다.',
    demoActionLabel: '강세·약세 분석 및 뉴스 피드 열기',
  },
  7: {
    sectionKicker: '08. Act 5 · 컨텍스트 AI 리서치 어시스턴트 드로어 (⌘K)',
    title: '지금 내 화면에 떠 있는 데이터를 이미 알고 있는 AI 애널리스트',
    subtitle:
      '티커나 재무 숫자, 뉴스 제목을 복사·붙여넣기 할 필요 없이 바로 후속 질문을 던지세요.',
    screenshotCaption:
      '우측 접이식 AI 리서치 드로어(⌘K): 현재 차트 지표, 공급망, 관심종목 브리핑 및 실시간 웹 검색 출처 자동 연동.',
    analogyTitle: '내 모니터 옆에서 함께 화면을 보는 전담 애널리스트',
    analogyText:
      '일반 챗봇에 표를 복사해 붙여넣는 대신 ⌘K를 누르거나 "AI 리서치 질문"을 클릭하세요. 현재 보고 있는 기업·코호트 데이터와 관심종목을 즉시 인식하고 실시간 웹 검색까지 결합해 답합니다.',
    keyPoints: [
      {
        heading: '복사·붙여넣기 제로 (Zero Copy-Pasting)',
        detail:
          '현재 화면의 주가 배수, 공급망 기업, 로드된 뉴스 기사, 코호트 비교표를 매 질문마다 자동으로 컨텍스트에 주입합니다.',
      },
      {
        heading: '실시간 Google 검색 연동 + 클릭 가능한 출처',
        detail:
          '화면 밖의 최신 실적발표 발언이나 공시 세부 내용이 필요하면 실시간 웹 검색을 수행하고 출처 링크를 첨부합니다.',
      },
      {
        heading: '한국어·영어 양방향 리서치 응답 지원',
        detail:
          '선택된 인터페이스 언어(한국어 또는 영어)에 맞춰 기관급 마크다운 분석 리포트와 핵심 수치를 작성합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '컨텍스트 자동 주입 (Context Injection)',
        plainMeaning:
          '현재 화면에 표시된 정확한 숫자와 뉴스 목록을 AI에게 자동으로 전달해 화면과 일치하는 답변을 내놓게 하는 기술입니다.',
      },
      {
        term: '그라운딩 인용 출처 (Citations)',
        plainMeaning:
          'AI 답변 하단에 첨부되어 클릭 한 번으로 실제 근거 웹페이지를 열어볼 수 있는 검증 링크입니다.',
      },
    ],
    speakerScript:
      '분석 도중 구체적인 후속 질문이 생기면 Command-K를 눌러 우측 AI 리서치 드로어를 엽니다. 현재 화면의 재무 지표와 공급망, 뉴스는 물론 실시간 Google 검색까지 자동으로 연동되므로 "TSMC 증설이 NVIDIA와 내 관심종목에 어떤 영향을 주나요?"라고 물으면 출처가 포함된 한국어 답변을 즉시 받아볼 수 있습니다.',
    demoActionLabel: 'AI 리서치 드로어 라이브 열기',
  },
  8: {
    sectionKicker: '09. 기술 아키텍처 · 데이터 정합성 및 정직성',
    title: '철저한 실존 기업 검증: 가짜 티커 제로, 조작된 차트 제로',
    subtitle:
      'Context.dev, 실시간 시세 파이프라인, ADR 매핑, Gemini 구조화 출력, Firebase Firestore의 유기적 결합.',
    screenshotCaption:
      '엔드투엔드 아키텍처: 실존 상장주·ADR·비상장사 게이트키퍼, 실제 1D–1Y 스파크라인, 투명한 비상장 기업가치 표기.',
    analogyTitle: '프로덕션 수준의 데이터 정직성',
    analogyText:
      '팔로우 입력창에 무의미한 문자열을 넣으면 즉시 차단됩니다. SK하이닉스나 TSMC처럼 미국 ADR이 있는 기업은 (ADR) 표기와 함께 추적하고, Stripe·OpenAI 같은 비상장사는 가짜 차트 대신 실제 공개 기업가치를 보여줍니다.',
    keyPoints: [
      {
        heading: '1. Context.dev 뉴스 & 기업 인텔리전스 SDK',
        detail:
          '실시간 글로벌 뉴스 검색(`/v1/news/search`)과 기업 규모·투자 이력 조회(`/v1/company/search`)를 구동합니다.',
      },
      {
        heading: '2. 엄격한 팔로우 검증 & 명확한 (ADR) 구분 표기',
        detail:
          '미국 상장주·미국 거래 ADR(`ASML (ADR)`, `SKHY (ADR)`) 및 검증된 비상장사만 팔로우를 허용해 본국 원주와의 혼동을 방지합니다.',
      },
      {
        heading: '3. Gemini 병렬 구조화 추론 + Firestore 영구 저장',
        detail:
          '확신도 산출과 다국어 번역을 병렬 처리하며 관심종목과 북마크 기사를 Firestore에 안전하게 동기화합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: 'ADR (미국 주식예탁증서)',
        plainMeaning:
          '한국·대만·유럽 등 해외 기업의 주식을 미국 증시에서 달러로 편리하게 거래할 수 있도록 발행한 증서입니다.',
      },
      {
        term: '스파크라인 기간 (1D ~ 1Y)',
        plainMeaning:
          '관심종목 카드에 그려진 미니 추세선으로, 1일·5일·1개월·6개월·1년 실제 과거 종가 흐름을 보여줍니다.',
      },
    ],
    speakerScript:
      '내부 아키텍처에서 가장 중시한 원칙은 데이터 정직성입니다. 모든 팔로우 요청은 실시간 검증을 거치며, ASML이나 SK하이닉스 같은 미국 거래 ADR은 티커 옆에 명확히 (ADR)을 표기해 본국 상장 주식과 혼동하지 않도록 했습니다. 비상장 유니콘은 가짜 주가 차트 대신 실제 공개 기업가치를 투명하게 표시합니다.',
    demoActionLabel: '관심종목 및 실시간 검증 테스트',
  },
  9: {
    sectionKicker: '10. 해커톤 심사 기준 부합 & 라이브 데모 런치패드',
    title: 'Contextual Investing이 만들어내는 실시간 웹 인텔리전스 혁신',
    subtitle:
      '가짜 플레이스홀더 없이 모든 차트, 필터, 공급망, 다국어 지원이 실시간으로 작동하는 완성형 플랫폼.',
    screenshotCaption:
      '질의응답 중 아래 워크플로우 버튼을 클릭하면 해당 실시간 앱 화면으로 즉시 이동합니다.',
    analogyTitle: '5대 핵심 가치 총정리',
    analogyText:
      '살아 움직이는 오픈 웹 데이터를 누구나 다룰 수 있는 투자 의사결정 엔진으로 전환했습니다 — 일일 브리핑, 공급망 도미노 탐색, 자연어 비교, 한·영 완벽 지원까지 모두 지금 바로 테스트할 수 있습니다.',
    keyPoints: [
      {
        heading: '실질적 임팩트 & 창의적인 라이브 웹 융합',
        detail:
          '글로벌 다국어 뉴스, 실시간 주가·ADR 시세, 기업 개요, 공급망 그래프를 하나로 묶어 탭 10개 리서치 피로를 해소합니다.',
      },
      {
        heading: '높은 완성도 & 한·영 이중언어(EN / 한국어) 지원',
        detail:
          '모든 차트 기간, 커서 페이지네이션, 원클릭 팔로우, 코호트 매트릭스, AI 리서치 답변이 영어와 한국어로 완벽히 작동합니다.',
      },
      {
        heading: '현장에서 즉시 검증 가능한 실시간 반응성',
        detail:
          '검색 결과나 공급망 패널에서 새 기업을 팔로우하는 즉시 관심종목과 일일 브리핑이 실시간으로 반응합니다.',
      },
    ],
    jargonTranslator: [
      {
        term: '실시간 Q&A 데모 연동',
        plainMeaning:
          '각 슬라이드의 실행 버튼을 누르면 발표 중 곧바로 해당 실제 기능 화면으로 전환됩니다.',
      },
      {
        term: '발표자료 내보내기 (.pptx & PDF)',
        plainMeaning:
          '상단 툴바를 통해 고해상도 스크린샷과 발표 대본이 포함된 10장짜리 파워포인트(.pptx)와 PDF를 즉시 다운로드할 수 있습니다.',
      },
    ],
    speakerScript:
      '마무리하겠습니다. Contextual Investing은 다국어 글로벌 뉴스, 기업 프로필, 실시간 시장 시세, 그리고 공급망 네트워크라는 오픈 웹 데이터를 누구나 쉽게 이해하고 행동에 옮길 수 있게 만든 플랫폼입니다. 슬라이드에서 보신 모든 기능은 영어와 한국어로 지금 이 앱에서 실시간 작동하고 있습니다. 경청해 주셔서 감사합니다!',
    demoActionLabel: '라이브 코호트 비교 화면 열기',
  },
};

/**
 * Returns slides localized into the requested `locale` ('en' | 'ko') by merging
 * Korean text fields over the canonical English slide definitions.
 */
export function getLocalizedPitchSlides<T extends PitchSlideTranslatableFields>(
  locale: AppLocale,
  defaultSlides: T[]
): T[] {
  if (locale === 'en') return defaultSlides;
  return defaultSlides.map((slide) => {
    const koFields = HACKATHON_SLIDES_KO[slide.index];
    if (!koFields) return slide;
    return {
      ...slide,
      ...koFields,
    };
  });
}
