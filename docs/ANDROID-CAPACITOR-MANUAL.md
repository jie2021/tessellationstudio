# 웹 앱을 Android Capacitor 앱으로 만드는 매뉴얼

이 문서는 Tessellation Studio의 Next.js 웹 앱을 Capacitor 기반 Android 앱으로 개발하고 APK 또는 AAB로 배포하는 절차를 설명합니다.

## 1. 현재 구조

이 프로젝트는 다음 흐름으로 Android 앱을 만듭니다.

```text
Next.js 소스
  -> next build
  -> out/ 정적 웹 자산
  -> cap sync android
  -> Android WebView 프로젝트
  -> Gradle
  -> APK 또는 AAB
```

주요 파일과 폴더:

- `next.config.mjs`: Next.js 정적 export 설정
- `capacitor.config.ts`: 앱 ID, 앱 이름, 웹 자산 폴더 설정
- `android/`: Capacitor가 생성한 Android Studio/Gradle 프로젝트
- `out/`: Next.js 정적 웹 빌드 결과
- `android/app/src/main/assets/public/`: Android 프로젝트에 복사된 웹 자산

## 2. 사전 준비

필요한 환경:

- Node.js 20.x
- npm
- Android Studio
- Android SDK Platform 35
- Android SDK Build Tools
- JDK 17 이상: Android Studio에 포함된 JetBrains Runtime을 사용할 수도 있음
- 실제 Android 기기 또는 Android Emulator

Node와 npm 버전을 확인합니다.

```powershell
node --version
npm --version
```

Android SDK 위치는 보통 다음 중 하나입니다.

```text
C:\Users\<사용자>\AppData\Local\Android\Sdk
C:\Android\Sdk
```

현재 프로젝트의 Android 설정은 다음 버전을 사용합니다.

```text
minSdkVersion = 23
compileSdkVersion = 35
targetSdkVersion = 35
```

따라서 Android 6.0, API 23 이상을 지원합니다.

## 3. JAVA_HOME 설정

잘못된 `JAVA_HOME`은 Gradle 빌드를 즉시 실패시킵니다.

현재 값을 확인합니다.

```powershell
$env:JAVA_HOME
Test-Path $env:JAVA_HOME
java -version
```

현재 PowerShell 세션에서 임시로 설정하는 예:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

사용자 환경 변수로 저장하는 예:

```powershell
[Environment]::SetEnvironmentVariable(
  'JAVA_HOME',
  'C:\Program Files\Android\Android Studio\jbr',
  'User'
)
```

새 터미널을 연 뒤 다시 확인합니다. 설치 위치가 다르면 실제 JDK 폴더를 사용해야 합니다.

## 4. Capacitor 패키지 설치

현재 프로젝트가 사용하는 패키지:

```text
@capacitor/core
@capacitor/cli
@capacitor/android
```

새 프로젝트에 직접 추가하는 경우:

```powershell
npm install @capacitor/core
npm install --save-dev @capacitor/cli @capacitor/android
```

현재 프로젝트에서는 전체 의존성을 설치하면 됩니다.

```powershell
npm install
```

## 5. Next.js 정적 빌드 설정

Capacitor는 Next 서버를 Android 앱 안에서 실행하지 않습니다. WebView에 넣을 정적 웹 자산이 필요합니다.

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

정적 빌드:

```powershell
npm run build:web
```

성공하면 `out/`이 생성됩니다.

정적 export에서 지원되지 않는 SSR, 서버 API, 서버 전용 기능은 네이티브 앱에서도 그대로 사용할 수 없습니다. 원격 API가 필요하면 별도 백엔드 서버에 HTTP 요청을 보내야 합니다.

## 6. Capacitor 설정

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tessellationstudio.app',
  appName: 'Tessellation Studio',
  webDir: 'out',
};

export default config;
```

각 항목:

- `appId`: Android applicationId. Play Store에서 앱을 식별하는 고유 ID입니다.
- `appName`: 사용자에게 표시되는 앱 이름입니다.
- `webDir`: Android 프로젝트에 복사할 웹 빌드 폴더입니다.

`appId`는 출시 후 변경하지 않는 것이 원칙입니다. 변경하면 Play Store에서 다른 앱으로 취급될 수 있습니다.

## 7. Android 프로젝트 최초 생성

Android 플랫폼이 아직 없다면 한 번 실행합니다.

```powershell
npx cap add android
```

`out/`이 없다는 경고가 나오면 웹 빌드 후 동기화합니다.

```powershell
npm run build:web
npx cap sync android
```

현재 `.gitignore`에는 `/android/`가 포함되어 있습니다. 이 경우 저장소를 새로 받은 환경마다 `npx cap add android`를 다시 실행해야 합니다.

팀 개발과 실제 배포 프로젝트에서는 보통 `android/`를 Git에 포함합니다. 네이티브 설정, 아이콘, 서명 설정, 플러그인 수정 사항을 보존해야 하기 때문입니다. 이 방식을 선택하려면 `.gitignore`의 `/android/` 항목을 제거하고 Android 프로젝트를 커밋합니다. 서명 키와 비밀번호는 절대 커밋하지 않습니다.

## 8. 웹 변경 사항 동기화

웹 코드를 수정한 뒤 다음 명령을 실행합니다.

```powershell
npm run cap:sync
```

현재 스크립트는 다음 두 작업을 수행합니다.

```text
npm run build:web
cap sync
```

`cap sync`는 다음을 처리합니다.

1. `out/`을 Android assets에 복사
2. Capacitor 설정 갱신
3. 설치된 네이티브 플러그인 갱신

웹 코드만 빠르게 복사할 때는 다음 명령도 사용할 수 있습니다.

```powershell
npx cap copy android
```

플러그인이나 설정이 변경됐다면 `copy` 대신 `sync`를 사용합니다.

## 9. Android Studio에서 실행

Android Studio로 프로젝트를 엽니다.

```powershell
npm run android:open
```

Android Studio에서:

1. Gradle Sync가 끝날 때까지 기다립니다.
2. SDK Platform 35 설치 요청이 나오면 설치합니다.
3. Device Manager에서 Emulator를 만들거나 USB 디버깅 기기를 연결합니다.
4. 상단 실행 대상에서 `app`을 선택합니다.
5. Run 버튼을 누릅니다.

CLI에서 실행할 수도 있습니다.

```powershell
npm run android:run
```

여러 기기가 연결되어 있으면 Capacitor CLI가 대상을 묻거나 대상 지정 옵션이 필요할 수 있습니다.

## 10. 실제 기기 연결

Android 기기에서:

1. 설정의 휴대전화 정보에서 빌드 번호를 여러 번 눌러 개발자 옵션을 활성화합니다.
2. 개발자 옵션에서 USB 디버깅을 켭니다.
3. USB로 PC와 연결합니다.
4. 기기에서 디버깅 허용 대화상자를 승인합니다.

연결 상태 확인:

```powershell
adb devices
```

`unauthorized`이면 기기의 승인 대화상자를 확인합니다. `adb` 명령이 없다면 Android SDK의 `platform-tools`를 PATH에 추가합니다.

## 11. Debug APK 빌드

프로젝트 루트에서:

```powershell
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

결과 파일:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

연결된 기기에 설치:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

`-r`은 기존 앱을 업데이트 설치합니다. applicationId와 서명 키가 기존 앱과 달라지면 업데이트가 실패할 수 있습니다.

## 12. Release APK 또는 AAB 빌드

Google Play 배포에는 일반적으로 AAB를 사용합니다.

Android Studio에서:

1. `Build` 메뉴를 엽니다.
2. `Generate Signed Bundle / APK`를 선택합니다.
3. `Android App Bundle`을 선택합니다.
4. 기존 keystore를 선택하거나 새 keystore를 만듭니다.
5. `release` 변형으로 빌드합니다.

CLI 빌드 명령:

```powershell
Push-Location android
.\gradlew.bat bundleRelease
Pop-Location
```

결과 파일:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Release APK가 필요하면:

```powershell
Push-Location android
.\gradlew.bat assembleRelease
Pop-Location
```

서명 설정이 없다면 release 결과가 서명되지 않았거나 설치할 수 없는 상태일 수 있습니다.

## 13. 서명 키 관리

Play Store 업데이트에는 최초 출시 때 사용한 동일한 서명 체계가 필요합니다.

권장 사항:

- keystore 파일을 안전한 별도 저장소에 백업합니다.
- keystore 비밀번호와 key 비밀번호를 비밀 관리 도구에 보관합니다.
- `key.properties`, `.jks`, `.keystore` 파일을 Git에 커밋하지 않습니다.
- CI에서는 비밀 환경 변수나 보안 파일 기능을 사용합니다.
- Google Play App Signing 사용을 검토합니다.

키를 잃으면 기존 앱 업데이트가 불가능해질 수 있습니다.

## 14. 앱 버전 변경

`android/app/build.gradle`의 값을 변경합니다.

```gradle
defaultConfig {
    versionCode 2
    versionName "1.1.0"
}
```

- `versionCode`: Play Store 업로드마다 증가하는 정수
- `versionName`: 사용자에게 표시되는 버전 문자열

`package.json` 버전은 Android의 `versionCode`를 자동으로 올리지 않습니다. 둘을 별도로 관리하거나 자동화 스크립트를 추가해야 합니다.

## 15. 앱 아이콘과 스플래시 화면

기본 Capacitor 아이콘을 제품 아이콘으로 교체해야 합니다. 일반적으로 Capacitor Assets 도구를 사용하거나 Android Studio의 Image Asset 기능을 사용합니다.

Android Studio 방식:

1. `android/app/src/main/res`를 우클릭합니다.
2. `New > Image Asset`을 선택합니다.
3. Launcher Icons를 생성합니다.
4. 일반 아이콘과 round 아이콘을 확인합니다.

관련 리소스:

```text
android/app/src/main/res/mipmap-*/ic_launcher.*
android/app/src/main/res/mipmap-*/ic_launcher_round.*
android/app/src/main/res/drawable*/splash.*
```

아이콘과 스플래시 변경 후 실제 기기와 여러 화면 밀도에서 확인합니다.

## 16. 권한과 네트워크

현재 `AndroidManifest.xml`에는 인터넷 권한이 있습니다.

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

카메라, 저장소, 위치 등 네이티브 기능을 추가하면 해당 Capacitor 플러그인과 Android 권한이 필요합니다. 런타임 권한 요청도 구현해야 합니다.

HTTPS가 아닌 HTTP API를 호출하면 Android 보안 정책에 의해 차단될 수 있습니다. 운영 API는 HTTPS를 사용합니다. 개발용 cleartext 허용은 필요한 범위에서만 적용하고 운영 설정에 남기지 않는 것이 좋습니다.

## 17. WebView와 모바일 UI 확인

Capacitor 앱은 Android WebView에서 실행됩니다. 다음 항목을 실제 기기에서 확인합니다.

- 화면 회전과 세로/가로 레이아웃
- 상태 표시줄과 내비게이션 바 safe area
- 터치 드래그와 페이지 스크롤 충돌
- 뒤로 가기 버튼 동작
- 키보드가 열릴 때 레이아웃
- 긴 터치와 컨텍스트 메뉴
- 저사양 기기에서 SVG 렌더링 성능
- 오프라인 실행 시 필요한 모든 폰트와 자산의 포함 여부

원격 CDN에 의존하는 자산은 오프라인에서 표시되지 않습니다. 중요한 폰트와 이미지는 프로젝트 내부에 포함하는 것이 안전합니다.

## 18. 디버깅

Chrome에서 WebView를 검사할 수 있습니다.

1. Android 기기에서 앱을 실행합니다.
2. PC Chrome에서 `chrome://inspect/#devices`를 엽니다.
3. 앱 WebView의 `inspect`를 선택합니다.
4. Console, Network, Elements를 확인합니다.

Android 로그 확인:

```powershell
adb logcat
```

앱 관련 로그를 좁혀 확인하려면 Android Studio Logcat을 사용하는 편이 편리합니다.

## 19. 문제 해결

### JAVA_HOME is set to an invalid directory

```powershell
Test-Path $env:JAVA_HOME
Get-Command java
java -version
```

실제 JDK 또는 Android Studio `jbr` 경로로 `JAVA_HOME`을 수정하고 새 터미널을 엽니다.

### missing out directory

원인: `npx cap add android` 또는 `cap sync` 전에 정적 빌드를 하지 않음

해결:

```powershell
npm run build:web
npx cap sync android
```

### 웹 수정 내용이 앱에 반영되지 않음

```powershell
npm run cap:sync
```

그 후 앱을 다시 빌드하거나 실행합니다. Android Studio가 이전 APK를 사용하면 Clean Project 또는 앱 삭제 후 재설치를 시도합니다.

### Gradle이 SDK를 찾지 못함

`android/local.properties`에 SDK 경로가 올바른지 확인합니다.

```properties
sdk.dir=C\:\\Users\\<사용자>\\AppData\\Local\\Android\\Sdk
```

이 파일은 로컬 환경 경로이므로 일반적으로 Git에 커밋하지 않습니다.

### 흰 화면 또는 자산 로딩 실패

- `out/index.html`이 존재하는지 확인합니다.
- `android/app/src/main/assets/public/`에 `_next/`와 `index.html`이 복사됐는지 확인합니다.
- `capacitor.config.ts`의 `webDir`이 `out`인지 확인합니다.
- Chrome WebView 검사에서 Console과 Network 오류를 확인합니다.

### Android 프로젝트가 저장소에 없음

현재 `.gitignore`가 `/android/`를 제외합니다. 다음 중 하나를 선택합니다.

- 재생성 방식: `npx cap add android` 후 `npm run cap:sync`
- 버전 관리 방식: `.gitignore`에서 `/android/`를 제거하고 네이티브 프로젝트를 커밋

제품 앱은 네이티브 사용자 정의를 보존하기 위해 두 번째 방식이 일반적입니다.

## 20. 배포 전 체크리스트

- [ ] `npm install`이 성공한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run build:web`이 통과한다.
- [ ] `npm run cap:sync`가 성공한다.
- [ ] `JAVA_HOME`과 Android SDK가 올바르다.
- [ ] Emulator와 실제 기기에서 핵심 기능을 테스트했다.
- [ ] applicationId, 앱 이름, 아이콘을 확인했다.
- [ ] `versionCode`를 이전 출시보다 높였다.
- [ ] release AAB가 올바른 키로 서명됐다.
- [ ] keystore와 비밀번호를 안전하게 백업했다.
- [ ] Play Console의 target SDK 요구사항을 확인했다.
- [ ] 개인정보 처리방침과 권한 사용 목적을 검토했다.
