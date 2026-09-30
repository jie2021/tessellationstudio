# 웹 앱을 Windows Electron 앱으로 만드는 매뉴얼

이 문서는 Tessellation Studio의 Next.js 웹 앱을 Electron 기반 Windows 데스크톱 앱으로 개발하고 NSIS 설치 파일로 배포하는 절차를 설명합니다.

## 1. 현재 구조

이 프로젝트는 다음 흐름으로 Windows 앱을 만듭니다.

```text
Next.js 소스
  -> next build
  -> out/ 정적 웹 자산
  -> Electron BrowserWindow
  -> electron-builder
  -> Windows NSIS 설치 파일
```

주요 파일은 다음과 같습니다.

- `next.config.mjs`: Next.js 정적 export 설정
- `electron/main.cjs`: Electron 메인 프로세스와 창 생성
- `electron/preload.cjs`: 렌더러에 제한적으로 기능을 노출하는 preload
- `package.json`: 개발 및 패키징 명령과 electron-builder 설정
- `out/`: `next build`가 생성하는 정적 웹 자산
- `dist/`: electron-builder가 생성하는 실행 파일과 설치 파일

## 2. 사전 준비

필요한 환경:

- Windows 10 또는 Windows 11
- Node.js 20.x
- npm
- 인터넷 연결: 최초 Electron 바이너리 다운로드에 필요

버전을 확인합니다.

```powershell
node --version
npm --version
```

의존성을 설치합니다.

```powershell
npm install
```

현재 사용되는 주요 패키지:

```text
electron
electron-builder
concurrently
wait-on
```

직접 새 프로젝트에 적용할 때는 다음처럼 설치할 수 있습니다.

```powershell
npm install --save-dev electron electron-builder concurrently wait-on
```

## 3. Next.js 정적 빌드 설정

Electron 설치본은 별도의 Next 서버를 실행하지 않습니다. 따라서 웹 앱을 정적 파일로 export해야 합니다.

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

빌드하면 `out/index.html`, `out/_next/` 등이 생성됩니다.

```powershell
npm run build:web
```

주의할 점:

- 서버 전용 API Route, SSR, 서버 액션 등 정적 export가 지원하지 않는 기능은 사용할 수 없습니다.
- 브라우저 API는 렌더링 시점에만 사용해야 합니다.
- `next/image`를 사용한다면 정적 export에 맞는 이미지 loader 설정이 필요할 수 있습니다.

## 4. Electron 메인 프로세스

Electron 진입점은 `electron/main.cjs`입니다. 개발 중에는 Next 개발 서버를 열고, 패키징된 앱에서는 `out/`을 로드합니다.

핵심 동작:

```js
if (isDevelopment) {
  window.loadURL('http://localhost:3000');
} else {
  window.loadURL('app://tessellation/index.html');
}
```

### app 프로토콜이 필요한 이유

Next 정적 HTML은 CSS와 JavaScript를 다음과 같은 루트 절대경로로 참조합니다.

```text
/_next/static/...
```

`window.loadFile('out/index.html')`처럼 `file://`로 열면 이 경로가 앱의 `out/`이 아니라 드라이브 루트로 해석될 수 있습니다. 그 결과 HTML 텍스트만 보이고 스타일과 JavaScript가 로드되지 않습니다.

이 프로젝트는 `app://` 사용자 프로토콜로 `out/`을 웹 서버의 루트처럼 제공합니다. 패키징 앱에서 `app://tessellation/_next/...`가 `out/_next/...`를 읽게 됩니다.

프로토콜 처리 시 반드시 경로 검증을 유지해야 합니다. 현재 코드는 요청 경로가 `out/` 밖으로 벗어나는 directory traversal을 차단합니다.

## 5. 보안 설정

현재 `BrowserWindow`는 다음 보안 설정을 사용합니다.

```js
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

권장 사항:

- 렌더러에서 `require`를 사용하기 위해 `nodeIntegration`을 켜지 않습니다.
- OS 기능이 필요하면 preload의 `contextBridge`로 최소 API만 노출합니다.
- preload에서 파일 시스템 전체나 임의 명령 실행 API를 노출하지 않습니다.
- 외부 URL을 앱 창에서 직접 열어야 한다면 탐색 제한과 허용 목록을 추가합니다.

## 6. Windows 기본 메뉴 제거

현재 앱은 Electron의 기본 `File`, `Edit`, `View` 메뉴를 제거합니다.

```js
const { Menu } = require('electron');

Menu.setApplicationMenu(null);
window.setMenu(null);
```

창 설정에도 다음 값이 있습니다.

```js
autoHideMenuBar: true
```

웹 앱 내부의 햄버거 메뉴와는 별개이며, Windows 창 상단의 Electron 메뉴만 제거합니다.

## 7. package.json 설정

Electron 진입점:

```json
{
  "main": "electron/main.cjs"
}
```

개발 명령:

```json
{
  "dev:web": "next dev -p 3000",
  "dev:electron": "wait-on http://localhost:3000 && electron electron/main.cjs",
  "dev:desktop": "concurrently -k \"npm:dev:web\" \"npm:dev:electron\""
}
```

패키징 명령:

```json
{
  "build:web": "next build",
  "build:desktop": "npm run build:web && electron-builder"
}
```

Windows 설치 프로그램 설정:

```json
{
  "build": {
    "appId": "com.tessellationstudio.desktop",
    "productName": "Tessellation Studio",
    "files": [
      "electron/**/*",
      "out/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

`files`에는 런타임에 필요한 파일만 넣습니다. 소스 전체를 포함하지 않아도 됩니다.

## 8. 개발 실행

웹 개발 서버와 Electron을 함께 실행합니다.

```powershell
npm run dev:desktop
```

동작 순서:

1. Next 개발 서버가 포트 3000에서 시작됩니다.
2. `wait-on`이 `http://localhost:3000` 응답을 기다립니다.
3. Electron 창이 개발 서버를 엽니다.
4. Next Fast Refresh를 사용할 수 있습니다.

포트 3000이 이미 사용 중이면 점유 프로세스를 확인합니다.

```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalAddress, LocalPort, State, OwningProcess
Get-Process -Id <PID>
```

필요한 경우 해당 프로세스를 종료하거나 개발 포트와 Electron URL을 함께 변경합니다.

## 9. Windows 설치 파일 생성

타입 검사를 먼저 실행합니다.

```powershell
npm run lint
```

Windows 설치 파일을 생성합니다.

```powershell
npm run build:desktop
```

주요 결과물:

```text
dist/win-unpacked/Tessellation Studio.exe
dist/Tessellation Studio Setup 0.0.1.exe
```

- `win-unpacked` 실행 파일은 설치 없이 빠르게 확인할 때 사용합니다.
- `Setup` 파일은 사용자에게 배포하는 NSIS 설치 프로그램입니다.
- 새 설치 파일을 테스트할 때는 기존 실행 중인 앱을 먼저 종료합니다.

## 10. 아이콘 설정

현재 별도 아이콘이 없으면 Electron 기본 아이콘이 사용됩니다. Windows 배포용 `.ico` 파일을 준비한 뒤 예를 들어 `build/icon.ico`에 둡니다.

```json
{
  "build": {
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    }
  }
}
```

권장 사항:

- 여러 크기가 포함된 ICO 파일을 사용합니다.
- 최소 256x256 레이어를 포함합니다.
- 설치 파일, 실행 파일, 작업 표시줄 표시를 모두 확인합니다.

## 11. 버전 변경

배포 전 `package.json`의 `version`을 변경합니다.

```json
{
  "version": "1.0.0"
}
```

생성되는 설치 파일 이름에도 버전이 반영됩니다. 이미 배포한 버전과 같은 번호로 새 설치본을 만들면 사용자와 운영 환경에서 구분하기 어렵습니다.

## 12. 코드 서명

테스트 빌드는 인증서 없이 만들 수 있지만, 외부 배포 시 Windows SmartScreen 경고가 나타날 수 있습니다. 정식 배포에서는 신뢰할 수 있는 코드 서명 인증서를 사용합니다.

일반적인 절차:

1. 코드 서명 인증서를 준비합니다.
2. 인증서 파일 또는 Windows 인증서 저장소를 구성합니다.
3. electron-builder의 인증서 환경 변수를 CI 또는 안전한 로컬 환경에 설정합니다.
4. 설치 파일과 실행 파일의 디지털 서명을 확인합니다.

인증서 비밀번호나 개인 키는 저장소에 커밋하지 않습니다.

## 13. 문제 해결

### 앱에 텍스트만 보이고 스타일이 적용되지 않음

원인:

- `file://`에서 `/_next/...` 절대경로를 찾지 못함

확인:

- `out/index.html`에서 `href="/_next/` 또는 `src="/_next/` 검색
- 개발자 도구 Network/Console에서 `ERR_FILE_NOT_FOUND` 확인

해결:

- 현재 프로젝트처럼 `app://` 프로토콜을 사용합니다.
- `window.loadFile`로 되돌리지 않습니다.

### Electron 창이 열리지 않음

- 먼저 `npm run dev:web`이 정상인지 확인합니다.
- 포트 3000 점유 여부를 확인합니다.
- `node --check electron/main.cjs`로 문법을 검사합니다.
- `npm run dev:electron`을 별도로 실행해 오류를 확인합니다.

### 패키징 후 빈 화면

- `out/index.html`이 생성되었는지 확인합니다.
- `package.json`의 `build.files`에 `out/**/*`가 포함됐는지 확인합니다.
- `app://` 프로토콜이 `app.whenReady()` 후 등록되는지 확인합니다.
- `dist/win-unpacked/resources/app.asar`에 자산이 들어갔는지 확인합니다.

### 이전 화면이나 메뉴가 계속 보임

- 기존 앱 프로세스를 종료합니다.
- `npm run build:desktop`을 다시 실행합니다.
- 새로 생성된 Setup 파일로 재설치합니다.
- 설치 파일의 버전과 생성 시간을 확인합니다.

## 14. 배포 전 체크리스트

- [ ] `npm install`이 성공한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run build:web`이 통과한다.
- [ ] `npm run dev:desktop`에서 주요 기능을 확인한다.
- [ ] `npm run build:desktop`이 통과한다.
- [ ] `win-unpacked` 실행 파일에서 CSS와 JavaScript가 로드된다.
- [ ] NSIS 설치, 실행, 제거를 확인한다.
- [ ] 앱 이름, 버전, 아이콘을 확인한다.
- [ ] 외부 배포라면 코드 서명을 확인한다.
