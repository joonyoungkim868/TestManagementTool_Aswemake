# DB 연동 가이드 (A to Z)

## 1. 개요
현재 이 애플리케이션은 **`storage.ts` 파일의 Mock DB 레이어**를 통해 브라우저의 `localStorage`에 데이터를 저장하고 있습니다. 이는 프로토타입용으로는 적합하지만, 5명 이상의 팀이 실제로 사용하기에는 다음과 같은 문제가 있어 부적합합니다:
1.  사용자 간 데이터가 공유되지 않음 (각자의 브라우저에만 저장됨).
2.  브라우저 캐시 삭제 시 데이터가 유실됨.

따라서 실제 운영 배포를 위해서는 `localStorage` 로직을 실제 백엔드 데이터베이스 API 호출로 대체해야 합니다.

---

## 2. 추천 데이터베이스 (Top 5)

이 도구는 **관계형 데이터** (프로젝트 > 케이스 > 단계, 실행 > 결과)와 **구조화된 이력 추적**이 핵심이므로, 관계형 데이터베이스(RDBMS)를 강력히 추천합니다.

| 순위 | 데이터베이스 | 유형 | 추천 여부 | 이유 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **PostgreSQL** | SQL | **최고의 선택** | 강력한 JSONB 지원 (테스트 단계 및 이력 로그 저장에 유리), 오픈소스, 높은 신뢰성. |
| **2** | **Supabase** | SQL (BaaS) | **가장 쉬운 구축** | PostgreSQL 기반. 인증(Auth) 및 DB API를 별도 백엔드 개발 없이 즉시 사용 가능. |
| **3** | **MySQL / MariaDB** | SQL | 표준 | 가장 대중적이며 호스팅을 구하기 쉬움. 정형화된 데이터 관리에 적합. |
| **4** | **Firebase** | NoSQL | 대안 | 실시간 업데이트에 유리하나, 복잡한 관계(예: 이력 로그 조인) 쿼리가 어렵거나 비용이 높을 수 있음. |
| **5** | **SQLite** | SQL | 경량 | 소규모 팀을 위해 작은 Node.js 서버 하나만 띄울 경우 적합 (파일 기반 DB). |

---

## 3. 연동 절차 (A to Z)

### 1단계: 백엔드 API 서버 구축
React 앱과 데이터베이스 사이를 중계할 서버(Node.js/Express, Python/Django, Spring Boot 등)가 필요합니다.
*   **인증(Auth):** JWT (JSON Web Tokens) 방식을 통한 보안 로그인 구현.
*   **엔드포인트:** `storage.ts`의 함수들과 1:1로 매칭되는 REST API 엔드포인트 생성.

### 2단계: 데이터베이스 스키마 생성
`types.ts` 파일의 인터페이스를 SQL 테이블로 변환해야 합니다.

**SQL 예시 (PostgreSQL):**
```sql
-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(50),
  status VARCHAR(20)
);

-- 프로젝트 테이블
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 테스트 케이스 테이블
CREATE TABLE test_cases (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  steps JSONB, -- 단계(Steps) 배열을 JSON으로 저장
  priority VARCHAR(20),
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 테스트 실행(Run) 테이블
CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title VARCHAR(255),
  case_ids JSONB, -- 포함된 케이스 ID 목록
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 테스트 결과(Result) 테이블 [New]
CREATE TABLE test_results (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES test_runs(id),
  case_id UUID REFERENCES test_cases(id),
  status VARCHAR(20), -- PASS, FAIL, BLOCK, NA
  actual_result TEXT,
  comment TEXT,
  issues JSONB, -- 결함 링크 목록
  step_results JSONB, -- [New] 단계별 수행 결과 (Step-level Results)
  tester_id UUID REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- 변경 이력 테이블
CREATE TABLE history_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(20), -- CASE, RESULT
  entity_id UUID,
  action VARCHAR(20), -- CREATE, UPDATE, DELETE
  changes JSONB, -- 변경 사항(Diff) JSON
  modifier_id UUID,
  timestamp TIMESTAMP
);
```

### 3단계: 프론트엔드 코드 마이그레이션
UI 컴포넌트를 수정할 필요는 없습니다. 오직 **`storage.ts`** 파일만 수정하면 됩니다.

1.  **`storage.ts` 파일 열기**: 모든 데이터 로직이 이곳에 모여 있습니다.
2.  **`// [DB_MIGRATION]` 주석 찾기**: 수정해야 할 함수마다 태그를 달아두었습니다.
3.  **로직 교체**:

**현재 (Mock):**
```typescript
// storage.ts
getAllUsers: (): User[] => {
  const data = localStorage.getItem('app_users');
  return data ? JSON.parse(data) : [];
}
```

**미래 (실제 API):**
```typescript
// storage.ts (변경 후)
getAllUsers: async (): Promise<User[]> => {
  const response = await fetch('https://api.your-company.com/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

### 4단계: 백엔드에서 반드시 구현해야 할 핵심 로직

1.  **변경 이력(History) 자동화:**
    *   현재 프론트엔드(`TestCaseService.saveCase`)에서 수행 중인 "변경 사항 비교(Diff)" 로직을 백엔드로 옮겨야 합니다.
    *   **이유:** 클라이언트는 조작될 수 있으므로, 데이터 무결성을 위해 서버가 원본 데이터와 수정 요청 데이터를 비교하여 로그를 남겨야 합니다.

2.  **삭제 정책(Deletion Policy):**
    *   섹션 삭제 시 하위 케이스를 함께 삭제하는 `Cascade Delete` 로직은 DB 레벨(Foreign Key Option) 또는 백엔드 트랜잭션으로 처리해야 안전합니다.

3.  **동시성 제어:**
    *   5명이 동시에 같은 케이스를 수정할 경우를 대비해, "최근 수정 우선(Last Write Wins)" 또는 "낙관적 잠금(Optimistic Locking)" 전략이 필요합니다.

---

## 4. API 체크리스트 (구현해야 할 엔드포인트)

| 리소스 | 메서드 | 엔드포인트 | 비고 |
| :--- | :--- | :--- | :--- |
| **Auth** | POST | `/auth/login` | JWT 토큰 반환 |
| **User** | GET | `/users` | 관리자만 호출 가능 |
| **Project** | GET | `/projects` | 활성 프로젝트 조회 |
| **TestCase** | GET | `/projects/:id/cases` | 섹션 포함 트리 구조 반환 |
| **TestCase** | POST | `/cases` | 케이스 생성 |
| **TestCase** | PUT | `/cases/:id` | 수정 및 **History Log 자동 생성** |
| **TestCase** | DELETE | `/cases/:id` | **[New]** 케이스 삭제 |
| **Section** | DELETE | `/sections/:id` | **[New]** 섹션 및 하위 케이스 일괄 삭제 |
| **TestRun** | POST | `/runs` | 실행 계획 생성 |
| **Result** | POST | `/results` | 결과(Pass/Fail/Steps) 전송 |
| **History** | GET | `/cases/:id/history` | 변경 이력 조회 |