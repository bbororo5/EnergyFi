# EnergyFi — Investor Frontend

React Native + Expo (TypeScript) application for EnergyFi STO investors.

## Prerequisites

- Node.js 24.x (via NVM)
- npm 11.x

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm start          # Expo dev server (QR code for mobile)
npm run web        # Web browser
npm run ios        # iOS Simulator
npm run android    # Android Emulator
```

## Project Structure

```
app/              # File-based routes (expo-router)
components/       # Reusable UI components
constants/        # Theme colors, config
hooks/            # Custom React hooks
assets/images/    # Icons, splash screen
docs/             # Design docs (screen specs, screenshots)
```

## Platforms

- iOS (via Expo)
- Android (via Expo)
- Web (via react-native-web)

## Documentation

- [Frontend Design Spec](docs/flutter-design.md) — Screen designs and UX flows (reference)
- [Root CLAUDE.md](../CLAUDE.md) — Project-wide agent instructions
- [Frontend CLAUDE.md](CLAUDE.md) — Frontend-specific agent instructions
