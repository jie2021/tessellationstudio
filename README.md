# Tessellation (Next.js migration)

Quick notes to get this project running locally after converting from Vite to Next.js.

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

## Other scripts
- `npm run clean` — remove Next build output
- `npm run lint` — run TypeScript type check

## Notes
- The Next entry page is `pages/index.tsx` which imports the existing app component at `src/App.tsx`.
- Tailwind is configured via `tailwind.config.cjs` and `postcss.config.cjs`; global CSS is at `src/index.css` and imported from `pages/_app.tsx`.
- If you downgraded React to satisfy Next's peer dependency, ensure `react` and `react-dom` are `^18.2.0` in `package.json`.

If you want, I can run `npm install` here or switch the project to use `pnpm`/`yarn` to avoid peer-resolution issues.
