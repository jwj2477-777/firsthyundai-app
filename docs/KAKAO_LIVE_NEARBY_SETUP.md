# 카카오 로컬 실시간 연동 · 퍼스트현대 v1.12

## 현재 완료된 일

- 퍼스트현대 앱 등록, 카카오맵 ON, REST API 키 발급, GitHub Actions secret `KAKAO_REST_API_KEY` 등록 (사용자 완료)
- Android 단지 상세의 `주변시설` 탭, 카카오맵 외부 검색 링크
- 별도 Cloudflare Worker `firsthyundai-nearby` 소스 및 GitHub 수동 배포 워크플로
- Worker의 Kakao API 비공개 호출, 주소 → 좌표 → 카테고리 검색, 직선거리/원문 링크 출력
- 조회 결과 서버 저장·GitHub 공개 JSON 복제 없음, `Cache-Control: no-store` 적용
- 요청은 고정 송도 아파트 ID, 열 가지 카테고리, 반경 1.5km, 상위 열 곳으로 제한. 20회/분 Cloudflare 처리 위치별 rate limit

## 다음 준비: Cloudflare Workers 무료 계정

기존 GitHub Actions와 안드로이드 앱은 상시 요청을 처리하는 HTTP 서버가 아닙니다.
카카오 REST API 키를 APK에 포함시키면 유출될 수 있고, 카카오 로컬 응답을 GitHub JSON에 보관해 재사용하는 것은 사용 조건상 적합하지 않습니다. 안전한 실시간 중계 서버가 필요합니다.

1. https://dash.cloudflare.com/sign-up 에 가입합니다. **Workers Free**를 선택하고 비즈니스용 유료 사용량 과금을 활성화하지 마세요.
2. Cloudflare 대시보드 → Workers & Pages에서 `workers.dev` 서브도메인을 활성화합니다.
3. Cloudflare 계정의 **Account ID**를 확인합니다.
4. https://dash.cloudflare.com/profile/api-tokens (로그인 후) → Create Token → **Edit Cloudflare Workers** 템플릿, 접근 계정은 본인 계정 한 개로 제한하여 발급합니다. API 토큰을 공개하거나 채팅에 올리지 마세요.
5. https://github.com/jwj2477-777/firsthyundai-app/settings/secrets/actions → **New repository secret**에서 다음 두 항목을 각각 등록합니다.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
   - `CLOUDFLARE_API_TOKEN`: 제한된 Cloudflare API Token
6. 이미 등록된 `KAKAO_REST_API_KEY`는 그대로 둡니다. **Kakao Admin key**를 절대로 사용하지 마세요.
7. https://github.com/jwj2477-777/firsthyundai-app/actions/workflows/deploy-kakao-nearby.yml → `Run workflow`를 **한 번만** 실행합니다. `main` 브랜치를 선택합니다. GitHub Actions가 계속 대기 상태라면 새 실행을 반복하지 마세요.
8. 성공 후 Cloudflare Workers & Pages에서 `firsthyundai-nearby` Worker 주소를 확인합니다.
   예: `https://firsthyundai-nearby.<본인서브도메인>.workers.dev` (예시는 실제 서비스 URL이 아닙니다).
9. 주소 끝에 `/health`를 붙여 `{"ok":true,"ready":true}`가 나오는지 확인합니다. 비밀키는 응답에 포함되지 않습니다.
10. **Worker의 공개 URL만** 대화로 알려주세요. 키와 Account ID 자체는 전달하지 마세요. 개발자가 `data/nearby_config.json`의 상태를 `ready`로 전환한 후 APK를 빌드합니다.

## 동작 검증

- 실시간 API 응답: `https://firsthyundai-nearby.<서브도메인>.workers.dev/nearby?complex=f13&category=HP8`.
- 정상 응답은 `schema_version=1`, `source=Kakao Local`, `places` 배열을 포함합니다.
- 0개 결과는 해당 **반경·카테고리 요청에서 결과가 없었다**는 뜻일 뿐 병원이 없다는 확정 의미가 아닙니다.
- `429`: 처리 위치별 20회/분 요청 제한. `503`: API key 또는 Rate Limiter 설정 누락. `502`: 외부 카카오 호출 실패. `422`: 해당 단지 주소 좌표 검증 실패.
- 배정학교 정보는 카카오 학교 검색 결과로 자동 판정하지 않습니다.
- `distance_m`는 **직선거리**이며 도보/운전 이동시간이 아닙니다.

## 비용·보안 정책

- 카카오맵 무료 쿼터는 개발자 계정에서 첫 번째로 활성화한 앱에만 제공합니다. 무료 쿼터 적용 앱 배지 확인: https://developers.kakao.com/docs/ko/kakaomap/common
- Cloudflare Workers Free는 일일 사용량 제한이 있습니다. 유료 전환 전에는 Cloudflare/카카오 사용량·계정 정책을 확인하세요.
- 중계 URL은 공개될 수 있습니다. Worker는 제한된 단지/시설 카테고리만 제공하고 처리 위치별 rate limiting을 적용하지만, 완전한 사설 인증망은 아닙니다. 사용량이 늘면 Cloudflare Access 또는 강한 서버 인증과 감사를 추가하세요.
- GitHub Actions 및 Cloudflare의 비밀 변수는 공개 소스에 삽입하지 않습니다.
- API 장소 결과를 GitHub `data/`에 올리거나 재가공 DB로 장기 보관하지 않습니다.
- Cloudflare Worker 코드는 `workers/kakao-nearby/src/index.mjs`, 설정은 `workers/kakao-nearby/wrangler.toml`.

## API 공식 문서

- https://developers.kakao.com/docs/ko/kakaomap/rest-api
- https://developers.kakao.com/docs/ko/kakaomap/common
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
