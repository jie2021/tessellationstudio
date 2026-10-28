# 보안 검토 보고서

**검토일:** 2026-10-28  
**프로젝트:** Tessellation Studio  
**기술 스택:** Next.js 16.4.3, React 19.3.1, Electron, Capacitor/Android  
**검토 유형:** 저장소 전체를 대상으로 한 원점 기준 보안 검토

## 요약

검토한 저장소에서 고신뢰도 악용 가능한 보안 취약점은 확인되지
않았습니다.

애플리케이션 코드, 렌더링 및 export 경로, Next.js 설정, Electron 격리,
Capacitor/Android 설정, CI/CD, 시크릿, npm 의존성 공급망 위험을
검토했습니다.

이 보고서는 검토일 현재 저장소 상태를 기준으로 작성한 증거 기반 검토
결과입니다. 향후 공개되는 의존성 취약점, 플랫폼 문제 또는 환경별 설정
변경으로 인해 새로운 위험이 발생하지 않는다는 의미는 아닙니다.

## 발견 사항

조치가 필요한 고신뢰도 보안 취약점은 발견되지 않았습니다.

| 번호 | 심각도 | 파일 | 줄 | 취약점 | 신뢰도 |
|---|---|---|---|---|---|
| - | - | - | - | 고신뢰도 취약점 없음 | - |

## 검토 영역

### 애플리케이션 코드

- 사용자 제어 HTML, URL, script 또는 CSS가 안전하지 않은 방식으로
  삽입되는 지점을 확인하지 못했습니다.
- `src/App.tsx`의 `dangerouslySetInnerHTML` 사용은 사용자 입력이 아니라
  정적 스타일시트를 포함합니다.
- SVG 경로, transform, 색상 및 export 파일명은 제한된 애플리케이션
  상태에서 생성됩니다.
- 서버/API endpoint, 인증, 권한 처리, 쿠키 또는 민감 정보 처리는
  확인되지 않았습니다.

### SVG, HTML export 및 파일 처리

- 브라우저 다운로드는 Blob URL과 고정된 파일명을 사용합니다.
- 네이티브 export는 Capacitor Filesystem을 통해 고정된 파일명을
  사용합니다.
- 공격자가 제어할 수 있는 파일 시스템 경로나 URL은 확인되지
  않았습니다.
- SVG export에 외부 마크업이나 신뢰할 수 없는 URL 참조가 포함되지
  않습니다.

### Next.js 16.4.3 및 React 19.3.1

- `next.config.mjs`의 정적 export 설정을 검토했습니다.
- 안전하지 않은 서버 라우트, rewrite, 노출된 시크릿 또는 운영 환경의
  디버그 설정은 확인되지 않았습니다.
- React 19 업그레이드 후 TypeScript 컴파일, Next.js 정적 빌드 및
  개발 서버 응답 검증을 완료했습니다.

### Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`가
  활성화되어 있습니다.
- 사용자 정의 `app://` protocol은 패키징된 `out` 디렉터리 내부로
  파일 해석 범위를 제한하고 디렉터리 traversal을 차단합니다.
- preload script는 읽기 전용 platform 값만 노출합니다.
- 개발 환경의 HTTP 로딩은 로컬 개발 workflow로 제한되어 있습니다.

### Capacitor 및 Android

- 외부에 노출된 비실행 컴포넌트, 안전하지 않은 JavaScript bridge,
  cleartext 네트워크 설정 또는 위험한 WebView 커스터마이징은
  확인되지 않았습니다.
- FileProvider는 외부에 export되지 않으며 URI 권한을 명시적으로
  부여합니다.
- `allowBackup="true"` 설정을 검토했습니다. 현재 앱은 민감한
  애플리케이션 상태를 저장하지 않으므로 고신뢰도 취약점으로
  판단하지 않았습니다.

### CI/CD 및 빌드 공급망

- GitHub Actions workflow 권한은 `contents: read`로 제한되어 있습니다.
- 의존성은 `npm ci`로 설치됩니다.
- workflow에서 신뢰할 수 없는 데이터가 shell 문자열에 삽입되는 패턴은
  확인되지 않았습니다.
- 의심스러운 패키지 저장소, 변경 가능한 custom registry 또는 원격
  실행 파일 다운로드는 저장소 코드에서 확인되지 않았습니다.

### 시크릿

- 추적 중인 `.env` 파일, 개인 키, keystore, 서명 설정, credential,
  token 또는 service-account 파일은 확인되지 않았습니다.
- 문서에서도 서명 credential을 Git 외부에 보관하도록 안내합니다.

### 의존성

- `package-lock.json`에는 무결성 metadata가 포함된 resolved package가
  기록되어 있습니다.
- `npm audit --json` 결과 informational, low, moderate, high 및
  critical 취약점이 모두 0건이었습니다.
- `npm audit --omit=dev` 결과 운영 의존성 취약점이 0건이었습니다.

## 검증 근거

- `npm audit --json`: 취약점 0건
- `npm audit --omit=dev`: 운영 의존성 취약점 0건
- `npm run lint`: 통과
- `npm run build:web`: 통과
- React 업그레이드 runtime validation: 3개 검증 통과, 회귀 0건
- `git diff --check`: 통과

## 지속적인 보안 관리 권고

1. 모든 의존성 업데이트마다 `npm audit`를 실행하고 lockfile 변경을
   검토하십시오.
2. Electron 보안 설정을 유지하고 protocol 또는 preload 변경 시 별도
   보안 검토를 수행하십시오.
3. 서명 키, keystore, token 및 환경 파일을 Git 외부에 보관하십시오.
4. 서버/API endpoint, 인증, 원격 콘텐츠 로딩 또는 새로운 native
   bridge를 추가할 때 이 검토를 다시 수행하십시오.
5. 앱이 사용자 문서 또는 민감한 상태를 저장하기 시작하면 Android
   backup 및 파일 공유 동작을 다시 검토하십시오.
