# Google Play 포팅 및 AAB 빌드 절차

이 문서는 Tessellation Studio 웹 앱을 Capacitor Android 앱으로 포팅하고
Google Play 배포용 Android App Bundle(AAB)을 준비하는 실제 절차를 기록합니다.

## 1. 포팅 구조

```text
Next.js 소스
  -> next build (정적 export)
  -> out/
  -> Capacitor sync
  -> android/ Android WebView 프로젝트
  -> Gradle bundleRelease
  -> app-release.aab
```

현재 앱 설정:

- 앱 이름: `Tessellation Studio`
- Android application ID: `com.jie.tessellationstudio`
- 웹 자산 폴더: `out`
- 최소 Android API: 23
- compile/target SDK: 35
- Android 버전: `versionCode 1`, `versionName "1.0"`

## 2. 필요한 환경

- Node.js 20.x 권장
- npm
- JDK 17 이상
- Android SDK Platform 35
- Android SDK Build Tools
- Android SDK Platform-Tools
- Google Play Console 계정
- 배포 시 사용할 업로드 keystore

현재 빌드 환경에서는 다음을 확인했습니다.

- Node.js `v22.18.0`
- npm `10.9.3`
- JDK `21.0.11`
- Android SDK: `C:\Users\jie\AppData\Local\Android\Sdk`
- Android SDK Platform/Build Tools 35 사용 가능

프로젝트가 요구하는 Node.js 엔진은 `20.x`이므로 재현 가능한 CI/배포 빌드에서는
Node.js 20을 사용하는 것이 좋습니다.

## 3. 의존성 설치와 정적 웹 빌드

프로젝트 루트에서 실행합니다.

```powershell
npm install
npm run lint
npm run build:web
```

`build:web`은 `next.config.mjs`의 `output: 'export'` 설정에 따라 `out/`을
생성합니다. Capacitor Android 앱은 Next.js 서버를 실행하지 않고 이 정적
파일을 Android WebView에서 로드합니다.

## 4. Android 프로젝트 생성 및 동기화

Android 플랫폼이 없는 최초 환경에서는 다음을 한 번 실행합니다.

```powershell
npx cap add android
```

이후 웹 소스가 변경될 때마다 다음 명령으로 빌드와 동기화를 함께 수행합니다.

```powershell
npm run cap:sync
```

`cap:sync`는 `npm run build:web`과 `cap sync`를 차례로 실행하고, `out/`의
파일을 `android/app/src/main/assets/public/`에 복사합니다.

## 5. Release AAB 생성

```powershell
Push-Location android
.\gradlew.bat bundleRelease
Pop-Location
```

생성 경로:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

이번 포팅에서 위 명령은 성공했고, 생성된 번들의 크기는 약 5.9 MB입니다.
현재 저장소에는 signing config나 keystore가 없으므로 이 파일은 **서명되지 않은
release AAB**입니다. 따라서 아직 Google Play Console에 업로드할 수 있는 최종
배포 파일은 아닙니다.

서명 여부 확인:

```powershell
jarsigner -verify -verbose -certs `
  .\android\app\build\outputs\bundle\release\app-release.aab
```

서명되지 않은 파일은 `jar is unsigned.`를 출력합니다.

## 6. Google Play 업로드용 서명

### 6.1 기존 앱 업데이트인 경우

최초 출시 때 사용한 업로드 키 또는 조직의 키 관리 절차를 사용해야 합니다.
기존 키를 분실한 경우 임의로 새 키를 만들면 기존 앱 업데이트가 되지 않으므로,
Google Play Console의 App signing 설정을 먼저 확인합니다.

### 6.2 신규 앱인 경우

Android Studio의 **Build > Generate Signed Bundle / APK > Android App Bundle**을
사용해 업로드 keystore를 지정하거나 새로 만들 수 있습니다. 새 keystore를
만들 때 다음 정보를 안전한 비밀 저장소에 보관합니다.

- keystore 파일
- keystore 비밀번호
- key alias
- key 비밀번호

CLI/CI에서는 Android Gradle Plugin의 `signingConfigs.release`에 keystore를
연결한 뒤 `bundleRelease`를 실행합니다. 비밀번호를 `build.gradle`, Git,
문서 또는 로그에 직접 작성하지 말고 환경 변수나 CI secret으로 주입합니다.

예시 흐름:

```powershell
# 서명 설정을 적용한 뒤 실행
Push-Location android
.\gradlew.bat clean bundleRelease
Pop-Location

jarsigner -verify -verbose -certs `
  .\android\app\build\outputs\bundle\release\app-release.aab
```

검증 결과에 `jar is unsigned.`가 없어야 합니다. 실제 업로드 전에는 Google Play
Console에서 Play App Signing을 활성화하고, 업로드 키와 앱 서명 키의 역할을
구분해 관리합니다.

## 7. 버전 및 Play Console 준비

새 AAB를 업로드할 때마다 `android/app/build.gradle`의 `versionCode`를 이전
업로드보다 큰 정수로 올립니다. 사용자에게 표시되는 `versionName`도 함께
갱신할 수 있습니다.

```gradle
defaultConfig {
    versionCode 2
    versionName "1.1"
}
```

Play Console에서 확인할 항목:

- application ID가 `com.jie.tessellationstudio`과 일치하는지
- target SDK 요구사항 충족 여부
- 앱 아이콘, 스플래시, 스크린샷
- 개인정보 처리방침 URL
- 콘텐츠 등급 및 데이터 보안 설문
- 광고/권한 사용 여부
- 서명된 AAB와 올바른 versionCode

## 8. 기기 검증

개발용 APK가 필요하면 다음 명령을 사용합니다.

```powershell
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

실제 기기 또는 에뮬레이터에서 다음을 확인합니다.

- 앱 시작과 정적 자산 로딩
- 세로/가로 화면과 safe area
- 터치 드래그 및 패턴 편집
- Android 뒤로 가기 동작
- 키보드 표시 시 레이아웃
- 오프라인 상태에서 폰트와 이미지 로딩
- 저사양 기기에서 SVG 렌더링 성능

## 9. 이번 실행 결과

완료된 단계:

1. TypeScript 검사: `npm run lint` 성공
2. Next.js 정적 빌드: `npm run build:web` 성공
3. Capacitor Android 프로젝트 생성: `npx cap add android` 성공
4. Android release bundle: `.\gradlew.bat bundleRelease` 성공
5. 산출물: `android/app/build/outputs/bundle/release/app-release.aab`

남은 배포 단계:

1. 배포용 keystore 또는 기존 업로드 키 확보
2. release signing config를 로컬 또는 CI secret으로 구성
3. 서명된 AAB 재빌드
4. `jarsigner`로 서명 검증
5. Play Console 내부 테스트 트랙에 업로드

## 10. 보안 주의사항

- keystore, `key.properties`, 비밀번호를 Git에 커밋하지 않습니다.
- 업로드 키와 Play App Signing 키를 별도로 백업합니다.
- CI 로그에 signing secret이 출력되지 않도록 합니다.
- `android/local.properties`에는 로컬 SDK 경로만 저장하고 커밋하지 않습니다.
- application ID와 서명 체계는 출시 후 변경하지 않습니다.
