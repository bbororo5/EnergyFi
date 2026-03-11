# Mobile Docs Map

## Purpose

`mobile/docs/` contains the UX, screen, and data-consumption documentation for the investor mobile app.
It is not the canonical source for smart-contract or business-policy decisions. For contract authority, always prioritize `contracts/docs/` and root-level `docs/`.

## Current Docs

| Document | Role |
|:---|:---|
| [home-onchain-spec.md](home-onchain-spec.md) | On-chain data consumption model for the Home screen |
| [analytics-evidence-desk.md](analytics-evidence-desk.md) | Direction for analytics and evidence presentation |
| [explore-redesign-spec.md](explore-redesign-spec.md) | Explore UX redesign direction |
| [design-system-rules.md](design-system-rules.md) | Shared UI copy and section-title rules for the mobile app |
| [d1-persona-scenario.md](d1-persona-scenario.md) | User scenarios and JTBD framing |

## Dependency Rule

- Mobile docs **consume** on-chain state; they do not define it.
- For contract structure, phase boundaries, and ERC usage, prioritize [`../../contracts/docs/README.md`](../../contracts/docs/README.md).
- For top-level system structure and deployment units, prioritize [`../../docs/README.md`](../../docs/README.md).
- Section titles across app pages follow the one-line, title-only rule and shared `sectionTitle` typography token defined in [`design-system-rules.md`](./design-system-rules.md).
