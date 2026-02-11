# Frontend (Flutter)

Mobile dashboard app for STO investors.

## Prerequisites
- Flutter SDK ^3.7.0 / Dart ^3.7.0

## Getting Started
```bash
# After installing the Flutter SDK:
cd frontend
flutter pub get
flutter run
```

## Project Structure
```
frontend/
├── pubspec.yaml                # Dependency definitions
├── analysis_options.yaml       # Lint rules
└── lib/
    ├── main.dart               # App entry point
    └── config/
        └── constants.dart      # Contract addresses, RPC URL
```

## Post-Deployment Action
Update the contract addresses in `lib/config/constants.dart` with the values from deployment output.
