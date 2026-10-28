# TStudio 보안 점검 및 개선 계획

## 1. 점검 범위

- React/Next.js 정적 웹 애플리케이션 코드
- Android Capacitor 프로젝트와 Manifest/FileProvider 설정
- Electron main/preload 프로세스와 IPC 노출
- 파일 저장/공유 및 SVG/PNG 내보내기
- 외부 링크와 브라우저 네비게이션
- 빌드 스크립트와 프로세스 실행 코드
- 의존성 매니페스트 및 알려진 취약점
- 저장소에 포함된 인증서, 토큰, 비밀값 및 민감 정보

## 2. 보안 검토 결과

2026-10-28 기준 전체 저장소를 검토한 결과, 즉시 수정이 필요한 고신뢰도 보안 취약점은 발견되지 않았다.

검토한 주요 항목:

| 영역 | 결과 |
|---|---|
| Electron 프로세스 격리, preload, IPC | 실행 가능한 취약점 없음 |
| Capacitor/Android WebView 및 Manifest | 과도한 위험 권한이나 외부 노출 컴포넌트 없음 |
| 파일 내보내기 및 공유 | 파일명이 고정된 앱 상태에서 생성되며 경로 주입 없음 |
| SVG 생성 및 PNG 변환 | 사용자 입력이 HTML/SVG 코드로 직접 삽입되지 않음 |
| React 렌더링/XSS | 사용자 제어 `dangerouslySetInnerHTML` 없음 |
| 외부 링크 | 외부 링크에 `noopener` 및 `noreferrer` 적용 |
| 셸/프로세스 실행 | 고정된 명령과 인자 사용, 사용자 입력 전달 없음 |
| 비밀값/자격 증명 | 저장소 내 노출된 비밀값 없음 |
| 의존성 | 현재 애플리케이션 사용 방식에서 즉시 악용 가능한 취약점 없음 |

## 3. 실행 계획 및 상태

### 완료

- [x] 소스, Android/Capacitor, Electron, 빌드 설정, 의존성 전체 검토
- [x] 파일 저장/공유 경로의 경로 조작 및 임의 파일 접근 여부 검토
- [x] XSS, HTML/SVG 삽입, IPC 노출, 외부 컴포넌트 노출 여부 검토
- [x] 인증서, 토큰, 개인 키 등 비밀정보 노출 여부 검토
- [x] TypeScript 타입 검사 실행
- [x] Android 디버그 빌드 검증
- [x] Capacitor 플러그인 동기화 검증

### 조건부 후속 조치

현재 수정할 취약점은 없으므로 기능에 영향을 줄 수 있는 임의의 권한 축소나 보안 설정 변경은 적용하지 않는다.

- [ ] 서버 기능을 추가할 경우 CSP, 보안 헤더, 인증/인가 검토를 별도로 수행
- [ ] Electron IPC 기능을 추가할 경우 허용 채널 목록과 입력 검증을 먼저 정의
- [ ] Android 파일 공유 범위를 확대할 경우 FileProvider 경로를 필요한 디렉터리로 제한
- [ ] 사용자 입력을 SVG/HTML로 렌더링할 경우 출력 인코딩 및 허용 목록 검토
- [ ] 릴리스 전 의존성 업데이트마다 `npm audit` 및 변경된 런타임 경로 재검토

## 4. 검증 명령

```text
npm run lint
npm run cap:sync
android\gradlew.bat -p android :app:assembleDebug
```

검토 시점에는 위 검증을 통과했으며, Gradle/Capacitor의 기존 deprecation 경고는 보안 취약점으로 분류하지 않았다.

## 5. 결론

현재 저장소에는 보안상 즉시 수정해야 할 고신뢰도 취약점이 없다. 이번 작업에서 수행할 보안 개선은 취약점 수정이 아니라 검토 결과와 재검토 기준을 문서화하는 것으로 완료한다. 새로운 네이티브 플러그인, 외부 입력, 서버 API, Electron IPC 또는 사용자 파일 경로 기능이 추가될 때 이 계획을 갱신하고 해당 영역을 다시 점검한다.

## 6. 추가 의존성 보안 점검 (2026-10-28)

Node.js/npm/Next.js/Electron 및 lockfile을 대상으로 추가 점검을 수행했다.

### 수정 완료

- [x] `next`를 `^16.1.6`에서 `^16.4.3`으로 업그레이드
- [x] `electron`을 `^44.5.1`에서 `^45.1.0`으로 업그레이드
- [x] `package-lock.json` 재생성 및 npm 의존성 감사 재실행
- [x] Next.js standalone/server 배포 시 노출될 수 있던 Next.js 취약 버전 제거
- [x] 데스크톱 런타임의 Electron 취약 버전 제거
- [x] `source-map-js` 전이 의존성을 npm `overrides`로 `1.2.2`에 고정
- [x] `pptxgenjs` 전이 의존성 `image-size`를 npm `overrides`로 `2.0.4`에 고정

### 남은 감사 항목

전체 의존성 감사에는 다음 항목이 남아 있다.

- 개발/빌드 도구 체인의 `concurrently`, `fast-uri`, `follow-redirects`,
  `http-cache-semantics`, `undici` 등 전이 의존성
- Node.js 22.18.0 기준으로 CI/배포 런타임을 통일

현재 앱의 고정된 개발 명령과 정적 export 배포 방식에서는 일부 항목의 런타임 노출이 확인되지 않았으나, 의존성 업데이트 또는 빌드 도구 교체 시 후속 처리 대상으로 유지한다.

### 추가 검증

```text
npm audit --omit=dev --json
npm audit --json
npm run lint
npm run build:web
npm run cap:sync
android\gradlew.bat -p android :app:assembleDebug
```

`source-map-js`와 `image-size`는 npm override로 패치 버전에 고정했으며, 전체 `npm audit` 결과는 현재 취약점 0건이다. Next.js를 `output: 'export'`로 사용하는 기본 배포에서는 서버 전용 Next.js 취약점의 노출이 제한된다. 다만 `NEXT_PRIVATE_STANDALONE=true` 또는 `next start`를 외부에 노출하는 경우에는 업그레이드된 버전을 계속 유지해야 한다.

## 7. Node.js 런타임 표준화 (2026-10-28)

- 기준 런타임: Node.js `22.18.0`
- 패키지 엔진 범위: `>=22 <23`
- 로컬 버전 파일: `.nvmrc`
- GitHub Actions: `.github/workflows/ci.yml`에서 `.nvmrc`를 사용
- 배포 빌드: 배포 환경에서 `.nvmrc`와 동일한 Node.js 버전을 사용하고 `npm ci`로 lockfile을 기준으로 설치
