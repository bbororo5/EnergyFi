# Hackathon Feature Demo Video Runbook

Use this document to turn the seeded mobile surface into a 4-minute feature demo video for judges.

Prerequisite: complete the data and app setup in [hackathon-demo-runbook.md](./hackathon-demo-runbook.md) first.

For a screen-by-screen presenter script in Korean, use [hackathon-feature-demo-presenter-guide.md](./hackathon-feature-demo-presenter-guide.md).

## 1. Demo Goal

The video should leave judges with four takeaways:

1. EnergyFi reads real EV charging data, not mock portfolio numbers.
2. The numbers connect to hardware trust, settlement proof, and on-chain records.
3. Regions are explained as evidence surfaces, not as speculative rankings.
4. EnergyFi stops at the transparency layer; KYC and subscription happen on a licensed securities platform.

## 2. Capture Setup

- Final export: `1920x1080`, 16:9, Korean narration, about 4 minutes.
- Record the app in portrait and place it on a 16:9 canvas during editing.
- Keep the app centered and reserve side space for Korean captions or short callouts.
- Preferred recording surface: `mobile` web build or simulator with browser chrome hidden.
- Use EnergyFi mobile screens as the main footage.
- Use STRIKON screens and architecture images only as transition inserts.

## 3. Source Surfaces

### Main app footage

- `mobile/app/(tabs)/index.tsx` for `Home`
- `mobile/app/(tabs)/portfolio/index.tsx` for `Analytics`
- `mobile/app/(tabs)/portfolio/[id].tsx` for region drilldown
- `mobile/app/(tabs)/explore/index.tsx` for `Explore`
- `mobile/app/(tabs)/account/index.tsx` for partner boundary

### Insert assets

- `docs/assets/app_charging.png`
- `docs/assets/app_map.png`
- `docs/assets/architecture.png`
- `docs/assets/strikon_platform.png`

## 4. Shot List

| Time | Surface | Operator action | Korean narration beat | Burned-in caption |
| --- | --- | --- | --- | --- |
| `0:00-0:12` | Insert assets | Show `app_charging`, `app_map`, then `architecture` | 아파트 EV 충전 수익은 매일 발생하지만, 개인 투자자는 그 자산을 직접 볼 수도, 검증할 수도 없었습니다. | `From charger to chain` |
| `0:12-0:22` | Splash -> `Home` | Let splash finish, land on `Home`, hold hero for 2 seconds | EnergyFi는 이 문제를 하드웨어부터 체인까지 이어지는 검증 가능한 데이터 흐름으로 풉니다. | `Verified revenue surface` |
| `0:22-0:45` | `Home` | Keep hero chart and main value visible, then lightly scrub the chart once | 이 첫 화면은 투자 권유가 아니라, 지금 체인 위에서 읽히는 월별 수익 증빙 화면입니다. | `On-chain revenue proof` |
| `0:45-1:00` | `Home` region carousel | Flip one region card, then open back side | 지역 카드는 pending revenue, finalized revenue, coverage, issuance state를 한 장에서 읽게 합니다. | `Region evidence card` |
| `1:00-1:10` | `Home` live feed + impact | Scroll just enough to show live feed and impact | 최근 세션과 누적 임팩트는 방금 기록된 운영 데이터와 연결됩니다. | `Recent charging sessions` |
| `1:10-1:45` | Region detail, recommended `KR11` | Open a finalized region from `Home` or `Analytics` | 먼저 finalized 데이터가 있는 지역을 보겠습니다. pending과 finalized를 구분해서 보여주기 때문에 숫자의 상태가 명확합니다. | `Pending vs finalized` |
| `1:45-2:05` | Same region detail | Hold bar chart and trust progress bars one second each | 이 구간에서 정산 이력, charger coverage, chip coverage, settlement continuity를 함께 읽습니다. | `Hardware trust coverage` |
| `2:05-2:25` | Region detail, recommended `KR29` or `KR49` | Switch to a pending-only region and hold the empty/fallback state | 아직 finalized 되지 않은 지역은 숨기지 않고 pending-only로 그대로 드러냅니다. 좋은 숫자만 편집해서 보여주지 않습니다. | `Pending-only fallback` |
| `2:25-2:45` | `Explore` | Open `Explore`, search once by region code or name | Explore는 APY 순위표가 아니라 지역의 운영 특성과 수익 리듬을 읽는 스토리 브라우저입니다. | `Neutral region stories` |
| `2:45-3:05` | `Explore` | Apply `Published` filter once, then show one awaiting card | 데이터가 없는 지역도 중립적으로 남겨 둡니다. 비어 있다고 해서 실패로 읽히지 않도록 설계했습니다. | `Published and awaiting` |
| `3:05-3:30` | `Account` | Open `Account`, hold partner guidance card | EnergyFi는 읽고 검증하는 앱이고, 실제 KYC와 청약은 규제된 증권사 플랫폼에서 이뤄집니다. | `Information here, subscription off-app` |
| `3:30-4:00` | `Analytics` overview or back to `Home` | End on overview metrics and one evidence card | EnergyFi는 EV 충전 인프라 수익을, 하드웨어 서명부터 온체인 증빙까지 투자자가 직접 읽을 수 있게 만듭니다. | `Read the infrastructure` |

## 5. Region Picks

- Finalized example: start with `KR11` unless a different region has clearer chart movement in the seeded environment.
- Pending-only fallback: use `KR29` or `KR49`.
- If both pending-only regions look similar, prefer the one that also shows an attention item in `Analytics`.

## 6. Editing Rules

- Keep login, onboarding, and account profile exposure under 5 seconds each.
- Hold every important number for 1 to 2 seconds before scrolling.
- Use one interaction per beat: one tap, one message.
- Translate English UI labels through Korean narration and captions instead of changing pace or over-annotating the screen.
- Use STRIKON or architecture inserts only between sections, not as standalone product flows.

## 7. Language Boundaries

Do not say:

- token purchase in-app
- dividend claim in-app
- instant investment
- trading inside EnergyFi

Say instead:

- on-chain evidence
- settlement proof
- partner securities flow
- read-only transparency layer

## 8. Rehearsal Checklist

Before recording, confirm the demo still matches these expected states:

- `Home`
  - 6-point monthly revenue history visible
  - 4 recent live-feed sessions visible
  - impact summary visible
  - region carousel populated
- `Explore`
  - published region stories visible
  - one awaiting-data card visible
- `Analytics`
  - total sessions above 100
  - latest finalized period reads `Feb 2026`
  - `KR29` or `KR49` reads as pending-only
  - chip coverage warning visible
  - issuance-not-live attention visible

If any of these fail, reseed and re-run the mobile app before filming.
