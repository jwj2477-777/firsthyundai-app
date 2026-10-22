# 퍼스트현대 고정 서명키와 인앱 업데이트 최초 설정

## 설치 전 반드시 해야 할 한 번의 설정
1. 대화에서 다운로드한 `FirstHyundai-signing-backup-KEEP-PRIVATE.zip`을 안전한 개인 저장소 두 곳에 보관합니다. 이 ZIP 안에는 키스토어 및 비밀번호가 들어 있습니다.
2. 같은 대화에서 내려받은 `FirstHyundai-GitHub-Secret-FHD_SIGNING_BUNDLE_B64.txt`의 한 줄 전체를 복사합니다. 파일 자체가 **비밀 개인키**와 동일하게 민감합니다.
3. https://github.com/jwj2477-777/firsthyundai-app/settings/secrets/actions 에서 **New repository secret**을 누르고 이름을 `FHD_SIGNING_BUNDLE_B64`, 값은 위 Base64 한 줄 전체로 등록합니다.
4. 등록 후 https://github.com/jwj2477-777/firsthyundai-app/actions/workflows/build-apk.yml 의 **Run workflow → main**을 실행합니다. 새로운 v2.0.14 Release가 생성되면 APK 버전·`Stable production APK signing fingerprint verified` 로그를 확인합니다.

## 설치 전 백업
- v2.0.13까지의 APK는 매번 `assembleDebug`로 빌드되었으므로 다음 release 서명과 같다고 보장할 수 없습니다. 기존 앱이 서명 충돌로 덮어쓰기 불가라면 먼저 앱 `내 자료`를 JSON으로 백업하고 실제 파일이 정상인지 확인하세요. 그 다음 기존 앱을 제거해 새 정식 APK를 설치하고 JSON 복원을 합니다.
- 이후에는 **동일한 개인키 + 동일한 applicationId + 더 높은 versionCode**를 유지하면 기존 앱 위에 설치해 자료를 보존할 수 있습니다. 시스템 설치 확인은 필요할 수 있습니다.

## 보안 운영 원칙
- `FHD_SIGNING_BUNDLE_B64` 비밀은 공개 저장소, 이슈, 채팅 메시지, 로그에 절대로 쓰지 않습니다.
- 키를 잃으면 같은 인증서로 후속 APK를 만들기 어렵습니다. 보안 백업을 유지해야 합니다.
- 빌드 워크플로우는 비밀키가 없거나 APK 서명 지문이 `docs/RELEASE_SIGNING_CERT_SHA256.txt`와 다르면 릴리스를 중지합니다. PR의 Debug 테스트 APK는 업데이트용으로 배포되지 않습니다.
- 인앱 업데이트는 GitHub의 검증된 버전과 APK 이름만 사용하며, 외부 브라우저를 통해 다운로드하고 Android 설치 승인 후 업데이트합니다. 자동 무음 설치 기능이 아닙니다.
