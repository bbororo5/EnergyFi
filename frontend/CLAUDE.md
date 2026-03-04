# EnergyFi Frontend — CLAUDE.md

Agent instructions for the EnergyFi investor frontend. Follows the root [CLAUDE.md](../CLAUDE.md).

---

## 1. Stack

| Component | Technology | Version |
|:---|:---|:---|
| Framework | React Native + Expo | SDK 54 |
| Language | TypeScript | ~5.9 |
| Router | expo-router | ~6.x (file-based routing) |
| Navigation | @react-navigation | v7 |
| Package Manager | npm | 11.x |
| Platforms | iOS, Android, Web | via Expo |

## 2. Project Structure

```
frontend/
  app/              # File-based routes (expo-router)
    _layout.tsx     # Root layout
    (tabs)/         # Tab navigator group
    +not-found.tsx  # 404 fallback
  assets/images/    # Icons, splash screen
  components/       # Reusable UI components
  constants/        # Theme colors, config
  hooks/            # Custom React hooks
  docs/             # Design docs (preserved from Flutter era)
  app.json          # Expo configuration
  package.json      # Dependencies
  tsconfig.json     # TypeScript config
```

## 3. Commands

```bash
npm start          # Start Expo dev server
npm run web        # Start web dev server
npm run ios        # Start iOS simulator
npm run android    # Start Android emulator
npm run lint       # Run ESLint
```

## 4. Conventions

- All new files must be TypeScript (`.ts` / `.tsx`).
- Use functional components with hooks. No class components.
- Follow expo-router file-based routing conventions.
- Reusable components go in `components/`, not in `app/`.
- Keep `app/` files thin — delegate logic to hooks and components.
- Use `constants/Colors.ts` for theme colors.

## 5. Key Boundaries

- The frontend reads on-chain data from EnergyFi L1 smart contracts (read-only for investors).
- Wallet connection will use WalletConnect v2 or similar (TBD).
- KYC/AML flows are handled by the securities firm, not this app.
- Revenue distribution display only — no on-chain write operations for dividends.

## 6. Dependencies Policy

- Use Expo-compatible libraries only (`npx expo install <package>`).
- Avoid bare React Native modules that require native linking unless absolutely necessary.
- Prefer `expo-image` over `react-native-fast-image`.
- Prefer `@expo/vector-icons` for icons.
