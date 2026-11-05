# 세미나 — 학생 학술 커뮤니티

학생들이 질문, 연구 경험, 읽을거리와 근거를 나누는 학술 대화 중심 커뮤니티입니다. 별도 빌드 도구 없이 동작하므로 GitHub Pages에 바로 배포할 수 있습니다.

## 포함된 기능

- 분야별 토론 피드와 검색
- 새 토론 및 댓글 작성
- 공감, 링크 복사, 관심 분야·트렌딩 UI
- Supabase 연결 전에도 예시 데이터로 전체 화면 확인 가능
- 학번 1400–1421만 허용하는 Supabase 회원 로그인
- 첫 로그인 후 개인 비밀번호 변경 강제 및 활성 회원 전용 RLS(행 수준 보안)
- 사용자별 중복 공감을 막는 `post_likes` 테이블과 DB 트리거 기반 집계

## Supabase 연결

1. Supabase에서 새 프로젝트를 만들고 **SQL Editor**를 엽니다.
2. [`supabase-schema.sql`](./supabase-schema.sql) 전체를 실행합니다.
3. **Authentication → Providers → Email**에서 **Confirm email**을 끕니다. 이 앱은 `student1400@seminar.local` 형식의 내부 로그인 이메일을 사용합니다.
4. **Project Settings → API**에서 Project URL과 **anon / publishable key**를 확인합니다.
5. [`app.js`](./app.js) 맨 위의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 각각 붙여 넣습니다.

`anon`(또는 publishable) 키는 브라우저에 넣는 공개 키입니다. `service_role` 키는 절대 커밋하거나 프런트엔드에 넣으면 안 됩니다.

## 회원 로그인 방식

- 허용 학번: `1400`부터 `1421`까지
- 첫 로그인: 학번과 공통 초기 비밀번호로 로그인합니다. 계정이 없으면 해당 학번의 계정을 한 번만 만듭니다.
- 첫 로그인 직후: 8자 이상의 개인 비밀번호로 교체해야 게시글과 댓글을 읽거나 쓸 수 있습니다.
- 이후 로그인: 학번과 개인 비밀번호를 사용합니다.

공통 초기 비밀번호는 `Seminar2026!`입니다. 배포 전에 [`app.js`](./app.js)의 `INITIAL_PASSWORD`와 [`supabase-schema.sql`](./supabase-schema.sql)의 `extensions.crypt('…')` 값을 **동일하게** 바꾸세요. SQL 쪽에서도 해시 비교로 초기 비밀번호를 강제하므로 브라우저 코드를 고쳐도 다른 비밀번호로 최초 계정을 만들 수 없습니다. 공통 비밀번호만으로는 실제 학생 신원을 완전히 확인할 수 없으므로, 중요한 서비스라면 학교 이메일 인증이나 학생별 초대 코드를 추가하세요.

## GitHub Pages 배포

1. 이 폴더에서 Git 저장소를 만들고 GitHub 저장소에 push합니다.
2. GitHub 저장소의 **Settings → Pages**에서 `Deploy from a branch`를 선택합니다.
3. `main` 브랜치와 `/(root)`를 선택해 저장합니다.
4. Pages가 안내하는 URL로 접속합니다.

배포 후 Supabase **Authentication → URL Configuration**의 Site URL에 GitHub Pages 주소를 추가해 두세요. 나중에 이메일 로그인 등을 연결할 때 필요합니다.

## 무료 플랜 메모

현재 Supabase Free 플랜은 활성 무료 프로젝트를 최대 2개 둘 수 있습니다. 이미 하나를 운용 중이라면 보통 이 프로젝트를 추가할 여유가 있습니다. 다만 저활동 무료 프로젝트는 7일 후 자동으로 일시 중지될 수 있으니, 실제 서비스라면 이 점을 운영 계획에 포함하세요. 자세한 한도는 [Supabase Billing 문서](https://supabase.com/docs/guides/platform/billing-on-supabase)와 [가격 페이지](https://supabase.com/pricing)를 확인하세요.

## 다음에 권할 기능

- 학교 이메일 인증 또는 학생별 초대 코드
- 신고·숨김·운영자 검토(학술적 대화의 질 유지)
- 논문 DOI/URL 미리보기와 출처 형식 도우미
- 좋아요를 별도 테이블로 분리해 사용자별 중복 공감 방지
