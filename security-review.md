# Security Review

**Review date:** 2026-10-28  
**Project:** Tessellation Studio  
**Runtime stack:** Next.js 16.4.3, React 19.3.1, Electron, Capacitor/Android  
**Review type:** Fresh repository-wide review from first principles

## Executive summary

No high-confidence exploitable security vulnerabilities were identified in the
reviewed repository.

The review covered application code, rendering and export paths, Next.js
configuration, Electron isolation, Capacitor/Android configuration, CI/CD,
secrets, and npm dependency supply-chain risks.

This is an evidence-based review of the repository state at the review date.
It is not a guarantee that future dependency disclosures, platform issues, or
environment-specific configuration changes cannot introduce risk.

## Findings

No actionable findings were identified.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| - | - | - | - | No high-confidence vulnerability found | - |

## Reviewed areas

### Application code

- No user-controlled HTML, URL, script, or CSS injection sink was identified.
- The `dangerouslySetInnerHTML` usage in `src/App.tsx` contains a static
  stylesheet rather than user-controlled content.
- SVG paths, transforms, colors, and export filenames are derived from
  constrained application state.
- No server/API endpoints, authentication, authorization, cookies, or
  sensitive-data processing were found.

### SVG, HTML export, and file handling

- Browser downloads use Blob URLs and fixed filenames.
- Native exports use fixed filenames through Capacitor Filesystem.
- No attacker-controlled filesystem path or URL was identified.
- SVG export does not incorporate external markup or untrusted URL references.

### Next.js 16.4.3 and React 19.3.1

- The static export configuration in `next.config.mjs` was reviewed.
- No unsafe server routes, rewrites, exposed secrets, or production debug
  settings were found.
- The React 19 upgrade was validated with TypeScript compilation, Next.js
  static build, and development-server response checks.

### Electron

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` are
  enabled.
- The custom `app://` protocol constrains resolved files to the packaged
  `out` directory and rejects traversal outside that directory.
- The preload script exposes only a read-only platform value.
- Development HTTP loading is limited to the local development workflow.

### Capacitor and Android

- No exported non-launcher components, unsafe JavaScript bridges,
  cleartext-network configuration, or dangerous WebView customization was
  found.
- The FileProvider is non-exported and grants URI permissions explicitly.
- `allowBackup="true"` was reviewed. No sensitive application state is stored
  by this application, so no high-confidence vulnerability was established.

### CI/CD and build supply chain

- GitHub Actions workflow permissions are restricted to `contents: read`.
- Dependencies are installed with `npm ci`.
- No shell interpolation of untrusted data was found in the workflow.
- No suspicious package source, mutable custom registry, or remote executable
  download was identified in repository code.

### Secrets

- No tracked `.env` file, private key, keystore, signing configuration,
  credential, token, or service-account file was found.
- Documentation instructs keeping signing credentials outside Git.

### Dependencies

- `package-lock.json` contains resolved packages with integrity metadata.
- `npm audit --json` reported zero informational, low, moderate, high, or
  critical vulnerabilities.
- `npm audit --omit=dev` reported zero production dependency vulnerabilities.

## Validation evidence

- `npm audit --json`: 0 vulnerabilities
- `npm audit --omit=dev`: 0 vulnerabilities
- `npm run lint`: passed
- `npm run build:web`: passed
- React upgrade runtime validation: 3 assertions passed, 0 regressions

## Recommended ongoing controls

1. Run `npm audit` and review lockfile changes in every dependency update.
2. Keep Electron security settings enabled and review any future protocol or
   preload changes separately.
3. Keep signing keys, keystores, tokens, and environment files outside Git.
4. Re-run this review after adding server/API endpoints, authentication,
   remote content loading, or new native bridges.
5. Review Android backup and file-sharing behavior again if the app begins
   storing user documents or other sensitive state.
