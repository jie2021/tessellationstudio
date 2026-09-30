# Tessellation Studio

## User Manuals

- [Mobile user manual](docs/MOBILE-USER-MANUAL.md)
- [Desktop user manual](docs/DESKTOP-USER-MANUAL.md)
- [Mobile user manual presentation](docs/Tessellation-Studio-Mobile-User-Manual.pptx)
- [Desktop user manual presentation](docs/Tessellation-Studio-Desktop-User-Manual.pptx)

## Build and Packaging Manuals

- [Windows Electron app manual](docs/WINDOWS-ELECTRON-MANUAL.md)
- [Android Capacitor app manual](docs/ANDROID-CAPACITOR-MANUAL.md)

## Prerequisites
- Node.js 18+ (recommended)
- npm (or use pnpm/yarn if preferred)

## Install
Install dependencies:

```bash
npm install
```

If you encounter peer dependency resolution errors (ERESOLVE), try:

```bash
npm install --legacy-peer-deps
```

or use `pnpm install` / `yarn install`.

## Development
Start the Next.js dev server on port 3000:

```bash
npm run dev
```

Open http://localhost:3000

## Build & Start (production)
Build and start the production server:

```bash
npm run build
npm run start
```

## Desktop App (Electron)
Run the Next.js development server and Electron shell together:

```bash
npm run dev:desktop
```

Create a Windows NSIS installer:

```bash
npm run build:desktop
```

The installer is written to `dist/`.

## Android App (Capacitor)
Build the static web assets and synchronize them into the Android project:

```bash
npm run cap:sync
```

Open the project in Android Studio or run it on a connected device:

```bash
npm run android:open
npm run android:run
```

Android builds require Android Studio, the Android SDK, and a valid JDK. Set
`JAVA_HOME` to the installed JDK directory before running Gradle or
`npm run android:run`.

## Other scripts

## Notes

If you want, I can run `npm install` here or switch the project to use `pnpm`/`yarn` to avoid peer-resolution issues.