# Hackathon Feature Demo Presenter Guide

이 문서는 발표자와 녹음 담당자가 화면 순서대로 바로 읽고 따라갈 수 있게 만든 가이드다.

- 데이터와 앱 준비: [hackathon-demo-runbook.md](./hackathon-demo-runbook.md)
- 촬영 타임라인과 자막: [hackathon-feature-demo-video.md](./hackathon-feature-demo-video.md), [hackathon-feature-demo-video.ko.srt](./hackathon-feature-demo-video.ko.srt)

## 30초 요약

이 영상의 핵심은 세 가지다.

첫째, EnergyFi는 충전 수익을 예쁘게 꾸며 보여주는 앱이 아니라, 하드웨어에서 시작된 실제 데이터를 온체인에서 읽게 하는 앱이다.

둘째, 숫자만 보여주지 않는다. 어떤 지역은 finalized, 어떤 지역은 pending-only로 그대로 드러내서 데이터의 상태를 정직하게 보여준다.

셋째, EnergyFi는 정보와 검증의 레이어이고, 실제 KYC와 청약은 증권사 파트너 영역이다.

## 전체 화면 순서

| 순서 | 화면 | 예상 시간 | 핵심 메시지 | 추천 포인트 |
| --- | --- | --- | --- | --- |
| 1 | 오프닝 인서트 | 10-15초 | 문제와 데이터 출발점 제시 | charger, map, architecture |
| 2 | Home | 50-60초 | 지금 체인 위에서 읽히는 수익 증빙 | hero, live feed, region card |
| 3 | Region Detail - Finalized | 35-45초 | finalized revenue와 hardware trust를 함께 본다 | `KR11` 권장 |
| 4 | Region Detail - Pending-only | 20-30초 | 안 좋은 상태도 숨기지 않는다 | `KR29` 또는 `KR49` |
| 5 | Explore | 35-40초 | ranking이 아니라 neutral story browser | published + awaiting 대비 |
| 6 | Account / Partner Boundary | 20-25초 | 정보는 EnergyFi, 청약은 증권사 | partner guidance card |
| 7 | Closing | 15-20초 | 하드웨어에서 체인까지 이어지는 증빙 | `Analytics` 또는 `Home` 복귀 |

## 발표 전 공통 원칙

- 숫자 위에서는 1~2초 멈춘다.
- 한 화면에서는 메시지 하나만 말한다.
- `투자 실행`, `토큰 구매`, `배당 청구`, `앱 내 거래` 같은 표현은 쓰지 않는다.
- 대신 `온체인 증빙`, `정산 증빙`, `하드웨어 신뢰`, `증권사 파트너 흐름`이라고 말한다.
- 영어 UI 문구는 그대로 두고, 한국어 멘트로 의미를 번역한다.

## 1. 오프닝 인서트

### 화면 목적

왜 이 프로젝트가 필요한지, 그리고 데이터가 어디서 시작되는지 짧게 보여주는 구간이다.

### 먼저 보여줄 요소

- `docs/assets/app_charging.png`
- `docs/assets/app_map.png`
- `docs/assets/architecture.png`

### 권장 멘트

아파트 EV 충전 수익은 매일 발생하지만, 개인 투자자는 그 자산을 직접 볼 수도, 검증할 수도 없었습니다.

EnergyFi는 이 문제를 단순한 보고서나 오라클이 아니라, 하드웨어에서 시작된 데이터 흐름으로 해결합니다.

충전기에서 측정된 데이터가 플랫폼을 거쳐 온체인으로 기록될 때, 투자자는 결과만이 아니라 데이터의 출처까지 이해할 수 있습니다.

### 이 화면이 증명하는 EnergyFi 가치

EnergyFi의 차별점은 토큰이 아니라 데이터 신뢰의 시작점이다.

이 오프닝은 `SE chip -> STRIKON -> Bridge -> on-chain`이라는 구조를 심사위원 머릿속에 먼저 심는다.

### 금지 표현

- “충전소를 바로 투자할 수 있습니다”
- “이 앱에서 바로 자산을 살 수 있습니다”

### 촬영/발표 팁

- 자산 이미지처럼 오래 잡지 말고, 문제 제기용 컷으로만 짧게 쓴다.
- 아키텍처 이미지는 복잡한 설명보다 `데이터 출발점`만 강조한다.

### 백업 플로우

- architecture 이미지가 너무 복잡해 보이면 `app_charging -> app_map` 두 컷만 쓰고 바로 `Home`으로 넘어간다.

## 2. Home

### 화면 목적

Home은 “지금 네트워크에서 무슨 일이 일어나고 있는가”를 보여주는 첫 증빙 화면이다.

### 먼저 보여줄 요소

- hero revenue 숫자와 월별 차트
- region carousel 카드 1장
- recent live feed
- impact summary

### 권장 멘트

이 첫 화면은 투자 권유 화면이 아니라, 지금 체인 위에서 읽히는 월별 수익 증빙 화면입니다.

상단 숫자는 네트워크 revenue를 읽고 있고, 아래 차트는 이미 finalized된 월별 기록을 기반으로 움직입니다.

또 아래 live feed에서는 최근에 기록된 충전 세션을 바로 확인할 수 있습니다.

즉, EnergyFi는 미래 기대수익을 과장하는 것이 아니라, 지금 발생한 운영 데이터를 읽게 합니다.

### 이 화면이 증명하는 EnergyFi 가치

Home은 `실시간 운영 데이터`와 `온체인 수익 기록`을 한 화면에 붙여서 보여준다.

이 장면만으로도 “mock portfolio 앱이 아니라 실제 계약 데이터를 읽는 앱”이라는 인상을 줄 수 있다.

### 금지 표현

- “수익률이 얼마나 좋다”
- “곧 배당이 나온다”
- “내 자산이 얼마가 된다”

### 촬영/발표 팁

- hero 숫자에서 최소 2초 멈춘다.
- 차트는 한 번만 가볍게 짚고 넘어간다.
- live feed는 1~2개 세션만 언급한다.

### 백업 플로우

- hero 차트가 기대보다 약하게 보이면 region carousel을 먼저 보여주고 다시 hero로 돌아온다.
- impact가 약해 보이면 live feed 중심으로 말하고 impact는 짧게 처리한다.

## 3. Region Detail - Finalized

### 화면 목적

이 구간은 “왜 이 숫자를 믿어야 하는가”를 설명하는 핵심 장면이다.

### 먼저 보여줄 요소

- `KR11` 같은 finalized region 진입
- pending revenue와 latest finalized 값
- finalized revenue history bar chart
- charger coverage, chip coverage, settlement continuity

### 권장 멘트

이제 한 지역으로 들어가서, 이 숫자가 왜 신뢰 가능한지 보겠습니다.

EnergyFi는 pending과 finalized를 구분해서 보여주기 때문에, 아직 확정되지 않은 수익과 이미 정산된 수익이 섞이지 않습니다.

그리고 단순 revenue 숫자만 보는 것이 아니라, charger coverage와 chip coverage, settlement continuity까지 함께 읽습니다.

즉 이 지역이 실제로 살아 있는 인프라 위에서 수익을 만들고 있는지까지 같은 화면에서 설명할 수 있습니다.

### 이 화면이 증명하는 EnergyFi 가치

EnergyFi는 수익 숫자만 올리는 프로젝트가 아니라, 수익의 상태와 데이터 신뢰를 함께 공개하는 프로젝트다.

이 화면에서 `evidence-first UX`와 `하드웨어-온체인 검증 구조`가 가장 분명하게 드러난다.

### 금지 표현

- “이 지역은 가장 수익성이 좋다”
- “이 지역이 투자 1순위다”
- “이 수익은 보장된다”

### 촬영/발표 팁

- pending, finalized, 차트, progress bar 순서로 천천히 내려간다.
- progress bar마다 1초 정도 멈추고, 무슨 의미인지 짧게 붙인다.

### 백업 플로우

- `KR11` 데이터가 예상보다 약하면 finalized history가 더 잘 보이는 다른 region으로 대체해도 된다.
- 그래도 detail이 애매하면 `Analytics` overview에서 evidence snapshot을 먼저 설명한 뒤 detail로 들어간다.

## 4. Region Detail - Pending-only

### 화면 목적

정산이 아직 끝나지 않은 지역도 숨기지 않는다는 점을 보여주는 구간이다.

### 먼저 보여줄 요소

- `KR29` 또는 `KR49`
- pending revenue
- finalized history가 비어 있는 fallback
- issuance not live 또는 attention 상태

### 권장 멘트

여기서는 아직 finalized 데이터가 없는 지역을 보겠습니다.

중요한 점은, EnergyFi가 이런 지역을 감추지 않는다는 것입니다.

정산 이력이 없으면 없는 대로 pending-only로 읽히게 하고, 사용자가 현재 데이터 상태를 오해하지 않게 만듭니다.

이런 방식은 보기 좋은 숫자만 보여주는 대시보드보다 훨씬 신뢰를 줍니다.

### 이 화면이 증명하는 EnergyFi 가치

EnergyFi의 가치는 `좋은 숫자만 보여주는 것`이 아니라 `데이터 상태를 정직하게 보여주는 것`이다.

pending-only fallback은 제품 신뢰를 높이는 중요한 UX 장치다.

### 금지 표현

- “이 지역은 나쁜 지역이다”
- “문제가 있는 지역이다”
- “투자하면 안 된다”

### 촬영/발표 팁

- fallback 문구를 너무 길게 읽지 말고, “아직 finalized 안 됨”만 또렷하게 전달한다.
- 부정적으로 말하지 말고, 데이터 상태 설명으로만 처리한다.

### 백업 플로우

- `KR29`가 기대와 다르면 `KR49`로 바로 바꾼다.
- 두 지역 모두 비슷하면 attention 리스트가 더 잘 보이는 쪽을 쓴다.

## 5. Explore

### 화면 목적

Explore는 EnergyFi가 ranking 앱이 아니라 지역을 읽는 story browser라는 점을 설명하는 화면이다.

### 먼저 보여줄 요소

- 검색 1회
- `Published` filter 1회
- published card 1장
- awaiting card 1장

### 권장 멘트

Explore는 APY 순위표가 아니라, 각 지역의 운영 특성과 수익 리듬을 읽는 화면입니다.

여기서는 operational trust, revenue rhythm, site character라는 세 축으로 지역을 설명합니다.

또 데이터가 아직 없는 지역도 목록에서 사라지지 않습니다.

즉, EnergyFi는 사람을 자극해서 클릭하게 만드는 방식이 아니라, 지역을 차분하게 이해하게 만드는 방식으로 설계되어 있습니다.

### 이 화면이 증명하는 EnergyFi 가치

Explore는 `neutral story browser`라는 제품 철학을 가장 잘 보여준다.

이 화면 덕분에 EnergyFi는 speculative funnel이 아니라 evidence browsing tool로 읽힌다.

### 금지 표현

- “상위 지역”
- “수익률 랭킹”
- “핫한 지역”

### 촬영/발표 팁

- search는 한 번만 한다.
- filter도 한 번만 누른다.
- published와 awaiting을 나란히 보여주며 “둘 다 보인다”는 점만 강조한다.

### 백업 플로우

- search 결과가 애매하면 filter만 사용한다.
- awaiting 카드가 아래에 있으면 스크롤을 조금 내려 대비만 만들고 바로 넘어간다.

## 6. Account / Partner Boundary

### 화면 목적

EnergyFi의 범위와 증권사 파트너 경계를 분명히 정리하는 마무리 전 화면이다.

### 먼저 보여줄 요소

- read-only profile 상태
- partner securities guidance card
- 단계별 partner flow

### 권장 멘트

마지막으로 중요한 경계를 보겠습니다.

EnergyFi는 데이터를 읽고 검증하는 앱이고, 실제 KYC와 suitability review, 그리고 청약은 증권사 파트너 플랫폼에서 진행됩니다.

즉 EnergyFi의 역할은 투자 실행이 아니라, 투자 판단에 필요한 데이터 신뢰를 제공하는 것입니다.

이 구분이 명확해야 규제 환경에서도 제품의 위치가 분명해집니다.

### 이 화면이 증명하는 EnergyFi 가치

이 장면은 `read-only transparency desk`라는 EnergyFi의 정체성을 고정한다.

동시에 증권사와의 역할 분리를 선명하게 보여줘 규제 리스크를 줄인다.

### 금지 표현

- “이제 여기서 바로 가입하면 됩니다”
- “앱 안에서 청약까지 끝납니다”
- “거래는 거의 준비됐습니다”

### 촬영/발표 팁

- 더미 프로필 숫자를 읽지 않는다.
- partner guidance 카드의 설명과 단계만 본다.

### 백업 플로우

- account 상단 프로필이 거슬리면 partner guidance 카드가 화면 중앙에 오도록 바로 스크롤한다.

## 7. Closing

### 화면 목적

전체 메시지를 한 문장으로 회수하는 마무리 구간이다.

### 먼저 보여줄 요소

- `Analytics` overview 또는 `Home` hero
- evidence card 또는 summary metric 한 장면

### 권장 멘트

정리하면, EnergyFi는 EV 충전 인프라 수익을 하드웨어 서명부터 온체인 증빙까지 연결해 투자자가 직접 읽을 수 있게 만듭니다.

우리는 수익만 보여주는 것이 아니라, 그 수익이 어디서 왔고 어떤 상태인지 함께 보여줍니다.

그리고 실제 투자 실행은 규제된 증권사 파트너 흐름에 남겨 둠으로써, 데이터 신뢰와 제도권 연결을 동시에 가져갑니다.

### 이 화면이 증명하는 EnergyFi 가치

마지막 장면은 `실제 데이터`, `증빙 중심 UX`, `규제 경계`라는 세 축을 한 번에 회수한다.

### 금지 표현

- “다음 단계는 바로 투자입니다”
- “곧 거래가 열립니다”

### 촬영/발표 팁

- 마지막 문장은 천천히 읽는다.
- 이 구간에서 새로운 기능을 추가로 보여주지 않는다.

### 백업 플로우

- `Analytics` overview가 더 깔끔하면 거기서 끝낸다.
- 화면이 복잡해 보이면 `Home` hero로 돌아가 한 문장으로 마무리한다.

## 빠른 점검표

- `Home`에서 on-chain evidence라는 말이 자연스럽게 나오는가
- finalized region에서 pending과 finalized 차이를 설명할 수 있는가
- pending-only region을 부정적으로 말하지 않는가
- `Explore`를 ranking처럼 설명하지 않는가
- `Account`에서 증권사 경계를 분명히 말하는가

이 다섯 가지가 자연스럽게 나오면 발표자는 바로 촬영에 들어가도 된다.
