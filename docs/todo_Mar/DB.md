# Supabase → NCP DB 마이그레이션 가이드

## 개요

기존 Supabase를 NCP(네이버 클라우드) PostgreSQL로 교체합니다.
데이터 마이그레이션은 불필요하며, PostgREST를 중간 계층으로 두어 기존 `@supabase/supabase-js` 코드를 그대로 유지합니다.

### 호환성 분석 결과

| Supabase 기능 | 사용 여부 | PostgREST 호환 |
|---------------|-----------|----------------|
| PostgREST 쿼리 (select, insert, update, delete) | O | O |
| RPC (`get_recursive_document_ids`) | O | O |
| `count: 'exact'`, `head: true` | O | O (`Prefer` 헤더 지원) |
| `insert().select().single()` | O | O (`return=representation` 지원) |
| Supabase Auth | X | - |
| Supabase Storage | X | - |
| Supabase Realtime | X | - |
| RLS (Row Level Security) | X | - |

**결론: 내부 기능/동작 변경 없이 DB만 교체 가능**

---

## 작업 범위 분류

### 사용자 직접 수행 (DBeaver / 터미널)
- NCP DB SQL 실행 (role 생성, 권한 부여, 함수 확인)
- PostgREST Docker 컨테이너 실행

### 코드 수정 (Claude 수행)
- `supabaseClient.ts` 연결 정보 변경
- `vite.config.ts` 프록시 설정 추가
- `src/storage.ts` RPC 파라미터명 버그 수정
- 동작 검증

---

## Phase 1: NCP DB 준비 (사용자 직접 수행)

### 1-1. 테이블 & 함수 확인

`01_init_schema.sql`은 이미 실행된 상태. 아래 쿼리로 `get_recursive_document_ids` 함수 존재를 확인합니다.

**DBeaver에서 실행:**
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_recursive_document_ids';
```

- 결과 1행 → 정상
- 결과 0행 → `01_init_schema.sql` 하단의 `CREATE OR REPLACE FUNCTION ...` 부분만 다시 실행

### 1-2. web_anon Role 생성 및 권한 부여

PostgREST가 익명 요청으로 DB에 접근할 수 있도록 Role을 생성합니다.

**DBeaver에서 실행:**
```sql
-- 1. 웹 요청 전용 익명 Role 생성
CREATE ROLE web_anon NOLOGIN;

-- 2. public 스키마 접근 권한 부여
GRANT USAGE ON SCHEMA public TO web_anon;

-- 3. 현재 존재하는 모든 테이블에 대한 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO web_anon;

-- 4. 향후 생성될 테이블에도 권한 자동 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO web_anon;

-- 5. ID 자동생성(SERIAL) 등을 위한 Sequence 권한 부여
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO web_anon;

-- 6. RPC(함수) 실행 권한 부여 (권장 - PostgreSQL 기본값으로 이미 허용되나 방어적 설정)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO web_anon;

-- 7. 향후 생성될 객체에도 권한 자동 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO web_anon;

-- 8. 접속 계정(Authenticator)이 web_anon으로 전환할 수 있도록 권한 부여 (필수)
-- PostgREST는 PGRST_DB_URI 계정으로 접속 후 SET LOCAL ROLE web_anon을 실행하는데,
-- 이 GRANT가 없으면 role 전환이 거부되어 모든 요청이 실패합니다.
-- [유저명]에 NCP DB 접속 시 사용하는 실제 계정명을 입력하세요.
GRANT web_anon TO "[유저명]";
```

### 1-3. PostgREST Docker 실행

빈 폴더에 `docker-compose.yml` 생성 후 실행합니다.

> **중요**: 현재 Vite 개발 서버가 포트 3000을 사용하므로, PostgREST는 **3001** 포트로 설정합니다.

```yaml
version: '3'
services:
  postgrest:
    image: postgrest/postgrest:latest
    ports:
      - "3001:3000"
    environment:
      PGRST_DB_URI: "postgres://[유저명]:[비번]@pg-3qntnr.vpc-pub-cdb-kr.ntruss.com:5432/[DB명]"
      PGRST_DB_SCHEMA: "public"
      PGRST_DB_ANON_ROLE: "web_anon"
```

```bash
docker-compose up -d
```

### 1-4. PostgREST 동작 확인

```bash
# 테이블 목록이 JSON으로 응답되면 정상
curl http://localhost:3001/
```

> **Phase 1 완료 후 Claude에게 알려주세요.** Phase 2 코드 수정을 진행합니다.

---

## Phase 2: 코드 수정 (Claude 수행)

### 2-1. `supabaseClient.ts` 수정

Supabase 클라우드 URL을 로컬 Vite 서버 주소로 변경하고, Anon Key를 더미 값으로 교체합니다.

**변경 전:**
```typescript
import { createClient } from '@supabase/supabase-js';

const PROJECT_ID = 'iimstdtlwuenzyxuywvo';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**변경 후:**
```typescript
import { createClient } from '@supabase/supabase-js';

// PostgREST 프록시: Vite dev server가 /rest/v1/* 요청을 PostgREST로 전달
const SUPABASE_URL = 'http://localhost:3000';

// PostgREST 단독 실행 시 JWT 검증을 하지 않으므로 더미 키 사용
const SUPABASE_ANON_KEY = 'dummy-key-for-postgrest';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**변경 이유:**
- `@supabase/supabase-js`는 내부적으로 `{SUPABASE_URL}/rest/v1/{테이블명}` 형태로 요청
- URL을 Vite 서버 자신(`localhost:3000`)으로 향하게 하면, Vite proxy가 이를 가로채서 PostgREST로 전달
- Anon Key는 PostgREST가 검증하지 않으므로 아무 문자열이나 가능

### 2-2. `vite.config.ts` 프록시 설정 추가

Supabase JS 클라이언트가 보내는 `/rest/v1/*` 요청을 PostgREST(`localhost:3001`)로 리다이렉트합니다.

**변경 전:**
```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
},
```

**변경 후:**
```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  proxy: {
    '/rest/v1': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/rest\/v1/, '')
    }
  }
},
```

**프록시 동작 흐름:**
```
supabase.from('users').select('*')
  → GET http://localhost:3000/rest/v1/users?select=*
  → Vite proxy가 가로챔
  → rewrite: /rest/v1/users → /users
  → target: GET http://localhost:3001/users?select=*
  → PostgREST가 NCP DB에서 조회 후 응답
```

**RPC 호출 흐름:**
```
supabase.rpc('get_recursive_document_ids', { target_folder_id: '...' })
  → POST http://localhost:3000/rest/v1/rpc/get_recursive_document_ids
  → Vite proxy가 가로챔
  → rewrite: /rest/v1/rpc/... → /rpc/...
  → target: POST http://localhost:3001/rpc/get_recursive_document_ids
  → PostgREST가 NCP DB 함수 실행 후 응답
```

### 2-3. `src/storage.ts` RPC 파라미터명 버그 수정

기존 코드에서 RPC 호출 시 파라미터명이 SQL 함수 정의와 불일치하는 버그가 있습니다.
마이그레이션과 무관한 기존 버그이나, PostgREST가 파라미터명을 엄격히 매칭하므로 반드시 수정해야 합니다.

- **SQL 함수 정의** (`01_init_schema.sql`): `get_recursive_document_ids(target_folder_id UUID)`
- **프론트엔드 호출** (`src/storage.ts:473`): `{ root_folder_id: contextId }` ← 불일치

**변경 전:**
```typescript
const { data, error } = await supabase.rpc('get_recursive_document_ids', { root_folder_id: contextId });
```

**변경 후:**
```typescript
const { data, error } = await supabase.rpc('get_recursive_document_ids', { target_folder_id: contextId });
```

---

## Phase 3: 동작 검증 (함께 수행)

Phase 2 코드 수정 후, 아래 기능별 검증을 진행합니다.

| 검증 항목 | 관련 서비스 | 확인 방법 |
|-----------|-------------|-----------|
| 로그인 | AuthService | 이메일 입력 → 유저 생성/조회 |
| 폴더/문서 CRUD | DriveService | 폴더 생성, 문서 생성, 이름 변경, 삭제 |
| 테스트 케이스 CRUD | TestCaseService | 케이스 생성, 수정, 삭제 |
| 테스트 실행 | RunService | Run 생성, 결과 저장, 완료 |
| 대시보드 통계 | DashboardService | RPC 호출 (`get_recursive_document_ids`) 포함 |
| CSV Import | TestCaseService.importCases | 대량 삽입 동작 |
| 문서 복제 | DriveService.duplicateDocument | Deep copy 동작 |

> 문제가 발생하면 브라우저 개발자도구 Network 탭에서 `/rest/v1/*` 요청의 응답을 확인합니다.

---

## 향후 (Production 배포 시)

개발 환경에서 검증이 완료되면, 실 서비스 배포 시에는:

1. NCP 서버(VM)에 PostgREST Docker를 배포
2. Nginx 등으로 도메인 연결 (예: `https://api.example.com`)
3. `supabaseClient.ts`의 URL을 해당 도메인으로 변경
4. `vite.config.ts` proxy 설정은 제거 (프로덕션에서는 직접 연결)
5. (선택) PostgREST에 JWT 검증 활성화하여 보안 강화
