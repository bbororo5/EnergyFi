# React Native Migration Baseline

## Purpose

This note records the baseline used to finish the `Design Code/` to `mobile/` migration pass.

## Source Of Truth

- Visual baseline: `Design Code/`
- React Native app: `mobile/`
- Current logo asset source: `Design Code/public/assets/company_logo_transparent.png`

## Decisions Locked In

- Migration style is hybrid.
  - EnergyFi branding, layout rhythm, and key interactions follow `Design Code`.
  - Safe-area behavior, overlays, and responsive sizing follow React Native-native rules.
- Onboarding remains a 4-step flow in `mobile/`.
- The bell icon opens an anchored preview popover.
  - The full notifications screen is retained as the archive/detail view from `View All Updates`.
- Web preview renders the Expo web build directly.
  - There is no artificial framed viewport layer.
  - Native devices remain fluid and safe-area aware.

## Explore Scope

- `Explore` is now the first mobile screen that reads `ReputationRegistry` directly.
- The screen is a story browser, not a ranking or APY comparison list.
- Monthly snapshot cards are composed from:
  - operational trust
  - revenue rhythm
  - site character
- Region cards remain visible even without data.
  - Fallback state is neutral: `Data not yet published`.
- Runtime address and RPC can be overridden with:
  - `EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS`
  - `EXPO_PUBLIC_AVAX_FUJI_RPC_URL`

## Analytics Scope

- `Analytics` is now a contract-backed evidence desk rather than a mock portfolio view.
- It reads settlement, station, charger, SE chip, monthly reputation snapshot, and STO deployment state directly from contract interfaces.
- Region drilldown routes now expect region codes such as `KR11`.
- Detailed screen design and field mapping live in `mobile/docs/analytics-evidence-desk.md`.

## Home Scope

- `Home` now uses a contract-backed factual layer for hero revenue, region cards, impact, and live feed.
- The hero preserves an optional ownership overlay hypothesis.
  - manual share input and future securities-firm API fetch are both supported as overlays
- Detailed field mapping lives in `mobile/docs/home-onchain-spec.md`.

## Asset Notes

- `mobile/app.json` now points to EnergyFi branding assets rather than Expo defaults.
- Unused Expo placeholder image assets were removed from `mobile/assets/images`.
