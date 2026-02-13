# DB 연동 및 아키텍처 가이드

## 1. 아키텍처 개요 (Hybrid Storage Layer)
현재 애플리케이션은 `src/storage.ts`를 통해 데이터 접근 계층이 추상화되어 있습니다.
설정(`USE_SUPABASE`)에 따라 두 가지 모드로 동작합니다.

1.  **Supabase 모드 (Production):** 실제 PostgreSQL DB와 통신하며 데이터 영속성 및 공유를 보장합니다.
2.  **LocalStorage 모드 (Demo/Dev):** 브라우저 로컬 스토리지에 데이터를 저장하여 별도 백엔드 없이 시연이 가능합니다.

---

## 2. Supabase 데이터베이스 스키마

실제 운영을 위해 Supabase(PostgreSQL)에 다음 테이블들이 생성되어 있어야 합니다.

### 핵심 테이블 SQL

```sql
-- 1. 사용자 (Users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'INTERNAL', -- 'ADMIN', 'INTERNAL', 'EXTERNAL'
  status TEXT DEFAULT 'ACTIVE'
);

-- 2. 프로젝트 (Projects)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. 섹션 (Sections)
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "parentId" UUID -- 계층형 구조 확장을 위해
);

-- 4. 테스트 케이스 (TestCases) - [중요] seq_id 포함
CREATE TABLE "testCases" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID REFERENCES projects(id) ON DELETE CASCADE,
  "sectionId" UUID REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  precondition TEXT,
  steps JSONB DEFAULT '[]', -- [{step, expected}] 배열
  priority TEXT DEFAULT 'MEDIUM',
  type TEXT DEFAULT 'FUNCTIONAL',
  "authorId" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  seq_id SERIAL -- [필수] 정렬 순서 보장을 위한 자동 증가 컬럼
);

-- 5. 테스트 실행 (TestRuns)
CREATE TABLE "testRuns" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  "caseIds" JSONB DEFAULT '[]', -- 실행 대상 케이스 ID 배열
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. 테스트 결과 (TestResults)
CREATE TABLE "testResults" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID REFERENCES "testRuns"(id) ON DELETE CASCADE,
  "caseId" UUID REFERENCES "testCases"(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'UNTESTED',
  "actualResult" TEXT,
  comment TEXT,
  issues JSONB DEFAULT '[]', -- [{label, url}]
  "stepResults" JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]', -- 실행 이력 스냅샷
  "testerId" UUID REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE
);

-- 7. 변경 이력 (HistoryLogs)
CREATE TABLE "historyLogs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityType" TEXT,
  "entityId" UUID,
  action TEXT,
  "modifierId" UUID REFERENCES users(id),
  "modifierName" TEXT,
  changes JSONB DEFAULT '[]',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);