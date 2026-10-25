# 퍼스트현대 공유 메모 · Firebase 푸시 설정

**현재 v2.1.05 APK는 푸시 수신과 서버 연결 코드를 포함하지만, Firebase 프로젝트 설정 두 가지가 등록되기 전까지 앱 종료 시 실시간 푸시는 활성화되지 않습니다.**

## 연결하기

1. Firebase 콘솔 https://console.firebase.google.com 에서 프로젝트를 만듭니다.
2. Android 앱 패키지 이름을 kr.co.firsthyundai.app 으로 등록하고 google-services.json 파일을 받습니다.
3. 프로젝트 설정 → 서비스 계정 → 비공개 키 생성에서 서비스 계정 JSON을 받습니다. Firebase Cloud Messaging API (HTTP v1)를 활성화합니다.
4. GitHub Actions Secrets https://github.com/jwj2477-777/firsthyundai-app/settings/secrets/actions 에서 두 개의 Repository Secret을 추가합니다.
   - FHD_FIREBASE_ANDROID_JSON = google-services.json 파일의 전체 내용
   - FHD_FCM_SERVICE_ACCOUNT_JSON = Firebase 서비스 계정 비공개 JSON의 전체 내용
5. Deploy Shared Office Settings: https://github.com/jwj2477-777/firsthyundai-app/actions/workflows/deploy-shared-settings.yml 에서 Run workflow를 실행하여 성공을 확인합니다.
6. 각 휴대폰에 v2.1.05를 설치하고, 기존 사무실 보안코드로 앱을 연결한 뒤 Android 알림 권한을 허용합니다. Firebase 설정은 인증된 서버에서 앱 실행 시 받아오므로 서버 설정 후 재설치는 필요 없습니다.
7. 메모 화면의 'FCM 푸시 연결됨' 표시를 확인하고, 한 휴대폰에서 테스트 메모를 붙여 다른 휴대폰의 앱 종료 상태 알림을 시험합니다.

서비스 계정 JSON은 **절대 채팅이나 GitHub 소스에 올리지 말고 Secret에만 입력**합니다. Google Play Services·네트워크·절전·강제중지 상태에 따라 FCM 알림은 늦거나 차단될 수 있습니다. 새 메모만 전송하며 작성자 본인과 수정/완료/삭제는 푸시 대상이 아닙니다. 알림 내용에는 고객·메모 텍스트가 없고, 기존 가족 보안잠금을 통과해야 내용을 볼 수 있습니다.
