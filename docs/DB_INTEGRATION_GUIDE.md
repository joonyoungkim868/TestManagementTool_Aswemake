# DB 연동 및 아키텍처 가이드 (Updated for Feb Overhaul)

## 1. 아키텍처 개요 (Supabase Only)
본 프로젝트는 **Supabase (PostgreSQL)** 를 단일 진실 공급원(Single Source of Truth)으로 사용합니다.
LocalStorage 지원은 폐기되었으며, 모든 데이터는 온라인 DB에 저장됩니다. 추후 확장을 고려하여 RDBMS 표준을 준수하는 스키마를 설계합니다.

---

## 2. 데이터베이스 스키마 (ERD)

기존 `Project` 중심 구조에서 `Drive (Folder/Document)` 구조로 전면 개편되었습니다.

### 2.1. 사용자 (Users) - [변경 없음]
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'INTERNAL', -- 'ADMIN', 'INTERNAL', 'EXTERNAL'
  status TEXT DEFAULT 'ACTIVE'
);
```

### 2.2. 드라이브 (Drive) - [신규]
프로젝트 단위를 대체하는 파일 시스템 구조입니다.

```sql
-- 폴더 (Folders)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  desc TEXT,
  "parent_id" UUID REFERENCES folders(id) ON DELETE CASCADE, -- 계층형 구조 (Root는 NULL)
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 인덱싱: 폴더 조회 성능 향상
CREATE INDEX idx_folders_parent ON folders("parent_id");
```

```sql
-- 문서 (Documents)
-- 기존의 'Project' 개념이 이 'Document'로 대체됩니다.
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" UUID REFERENCES folders(id) ON DELETE CASCADE, -- 소속 폴더
  title TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 2.3. 테스트 자산 (Test Assets) - [변경]
`projectId` 의존성이 제거되고 `document_id`로 변경됩니다.

```sql
-- 섹션 (Sections)
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID REFERENCES documents(id) ON DELETE CASCADE, -- [변경] Project -> Document
  title TEXT NOT NULL,
  "parent_id" UUID, -- Nested Section 지원
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 테스트 케이스 (TestCases)
CREATE TABLE "testCases" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID REFERENCES documents(id) ON DELETE CASCADE, -- [변경] Project -> Document
  "sectionId" UUID REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  precondition TEXT,
  steps JSONB DEFAULT '[]', -- [{step, expected}]
  priority TEXT DEFAULT 'MEDIUM',
  type TEXT DEFAULT 'FUNCTIONAL',
  "authorId" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  seq_id SERIAL,
  
  -- [신규] UI 편의성 필드
  note TEXT,
  platform_type TEXT DEFAULT 'WEB' -- 'WEB', 'APP'
);
```

### 2.4. 테스트 실행 (Test Execution) - [대규모 변경]

Runner는 이제 특정 프로젝트에 종속되지 않으며, 여러 문서(Document)를 한 번에 테스트할 수 있습니다.

```sql
-- 테스트 실행 (TestRuns)
CREATE TABLE "testRuns" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'OPEN', -- 'OPEN', 'COMPLETED', 'ARCHIVED'
  
  -- [변경] 다중 문서를 타겟팅하므로 JSONB 배열로 저장 (추후 RDBMS 마이그레이션 시 교차 테이블 권장)
  -- 예: ["uuid-doc-1", "uuid-doc-2"]
  "target_document_ids" JSONB DEFAULT '[]', 
  
  -- [신규] 메타 데이터
  phase TEXT, -- 'Dev', 'Stage', 'Production', or Custom
  assignees JSONB DEFAULT '[]', -- 유저 ID 배열 ["uuid-user-1", "uuid-user-2"]
  
  -- [신규] 결과 스냅샷 (COMPLETED 상태 전환 시 데이터 동결)
  -- 실행 종료 시점의 TestResult 및 관련 TestCase 정보를 통째로 덤프하여 저장
  "snapshot_data" JSONB, 

  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "completedAt" TIMESTAMP WITH TIME ZONE
);
```

```sql
-- 테스트 결과 (TestResults)
CREATE TABLE "testResults" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID REFERENCES "testRuns"(id) ON DELETE CASCADE,
  "caseId" UUID REFERENCES "testCases"(id) ON DELETE CASCADE,
  
  -- 결과 필드
  status TEXT DEFAULT 'UNTESTED', -- 'PASS', 'FAIL', 'BLOCK', 'NA', 'UNTESTED'
  "actualResult" TEXT,
  comment TEXT,
  issues JSONB DEFAULT '[]', 
  "stepResults" JSONB DEFAULT '[]',
  
  -- [신규] 디바이스/플랫폼 정보
  "device_platform" TEXT DEFAULT 'PC', -- 'PC', 'iOS', 'Android'
  
  "testerId" UUID REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  -- 결과 이력 (Retest logs)
  history JSONB DEFAULT '[]'
);
```

## 3. 핵심 로직 & 제약 사항

1.  **계층형 폴더 (Recursive Folders)**
    *   Supabase(PostgreSQL)에서는 `WITH RECURSIVE` 쿼리를 사용하여 폴더 트리를 구성할 수 있습니다.
    *   클라이언트(Front-end)에서는 `Lazy Loading`을 권장합니다. (폴더 클릭 시 하위 항목 Fetch)

2.  **Runner와 Test Case의 동기화 (Live State)**
    *   `OPEN` 상태의 Runner는 항상 `Active`한 Test Case를 참조합니다.
    *   Test Case가 삭제되면 Runner에서도 사라집니다 (UI 레벨에서 처리).
    *   Test Case의 내용(Steps)이 변경되면 Runner에도 즉시 반영됩니다.

3.  **스냅샷 (Snapshot Strategy)**
    *   Runner가 `COMPLETED` 되는 순간, 현재 조회되는 모든 결과(`TestResults`)와 원본 케이스(`TestCases`)를 병합하여 `testRuns.snapshot_data` 컬럼에 저장합니다.
    *   이후 원본 케이스가 삭제되거나 수정되어도, 종료된 Runner(리포트)는 이 스냅샷 데이터를 사용하여 렌더링해야 합니다.

4.  **확장성 고려 (Future Migration)**
    *   현재 `JSONB`로 저장되는 `target_document_ids`, `assignees` 필드는 추후 정규화(Normalization)가 필요할 수 있습니다.
    *   타 DB(MySQL 등)로 이관 시 `run_documents`, `run_assignees` 교차 테이블(Join Table) 생성을 권장합니다.