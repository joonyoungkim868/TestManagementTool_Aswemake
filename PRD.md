# 상세 기획서 (Product Requirement Document)
## 내부 QA 테스트 관리 도구 (Internal QA Test Manager)

### 1. 개요 (Overview)
**제품명:** Internal QA Test Manager  
**목표:** 사내 QA 엔지니어 5인 및 외부 협력사가 사용할 수 있는 가볍고 빠른 테스트 관리 도구 (TestRail 유사).  
**핵심 가치:** 빠른 실행 속도, 철저한 변경 이력(History) 추적, 명확한 역할 기반 권한 분리.  
**현재 기술 스택:** React 18, TypeScript, Tailwind CSS, Recharts, LocalStorage (Mock DB).

---

### 2. 사용자 역할 및 권한 (User Roles & Permissions)

| 역할 (Role) | 범위 (Scope) | 상세 권한 |
| :--- | :--- | :--- |
| **Admin (관리자)** | 시스템 전체 | • 사용자 관리 (초대/차단/권한변경)<br>• 프로젝트 생성/삭제<br>• 모든 테스트 케이스 및 실행에 대한 전체 접근 권한 |
| **Internal QA (내부)** | 프로젝트 전체 | • 테스트 케이스 생성/수정 (**본인 작성 케이스만 가능**)<br>• 테스트 실행(Run) 생성<br>• 테스트 수행 및 결과 입력 (Pass/Fail)<br>• 대시보드 조회 |
| **External (외부)** | 실행 전용 | • 할당된 프로젝트 조회<br>• 할당된 테스트 실행(Run) 수행<br>• **케이스 생성/수정 불가**<br>• **사용자 관리 접근 불가** |

**보안 참고:** 관리자는 사용자의 상태를 `INACTIVE`로 변경하여 즉시 접근을 차단할 수 있습니다.

---

### 3. 정보 구조 (Information Architecture)

1.  **Project (프로젝트)** (예: "모바일 앱 2.0 배포")
    *   **Section (섹션/폴더)** (예: "로그인", "결제")
        *   **Test Case (테스트 케이스)** (개별 테스트 단위)
            *   **History Logs (변경 이력)** (수정 내역 감사 로그)
    *   **Test Run (테스트 실행)** (테스트 수행 계획)
        *   **Test Results (실행 결과)** (특정 케이스에 대한 성공/실패 기록)

---

### 4. 기능 명세 (Functional Specifications)

#### A. 프로젝트 및 대시보드
*   **프로젝트 목록:** 활성화된 프로젝트만 표시.
*   **대시보드:**
    *   총 테스트 케이스 수.
    *   진행 중인 테스트 실행 수.
    *   평균 통과율 (%) 시각화.
    *   최근 활동 그래프 (막대 차트: 성공 vs 실패).

#### B. 테스트 케이스 관리 (라이브러리)
*   **레이아웃:** 2단 구조 (좌측: 섹션 트리, 우측: 케이스 목록/상세).
*   **케이스 속성:**
    *   제목(Title), 사전 조건(Preconditions - 마크다운 지원).
    *   우선순위(Priority): 높음, 중간, 낮음.
    *   유형(Type): 기능, UI, 성능, 보안.
    *   **단계(Steps):** 테이블 형식 (수행 절차 / 기대 결과).
*   **이력 추적 (History):**
    *   케이스가 수정될 때마다 자동으로 스냅샷 기록.
    *   로그 내용: 수정자 이름, 일시, 변경된 필드 (이전 값 -> 새로운 값).

#### C. 테스트 실행 (Test Execution)
*   **실행 생성:** 프로젝트 내 전체 케이스 혹은 특정 케이스를 선택하여 실행 계획 생성.
*   **실행 인터페이스:**
    *   목록에서 빠른 상태 변경 가능.
    *   모달 창에서 상세 수행 결과 입력 가능.
    *   **타이머 기능 제외.**
*   **상태 값:** 성공(PASS), 실패(FAIL), 차단됨(BLOCK), 재테스트(RETEST), 해당없음(N/A).
*   **결함 보고:** 실패 시 `실제 결과(Actual Result)` 및 `코멘트(Comment)` 입력 필수.

#### D. 사용자 관리 (관리자 전용)
*   전체 사용자 목록 조회.
*   사용자 역할(Role) 변경.
*   접근 권한 회수(차단) 및 복구.

---

### 5. 데이터 모델 (Schema)

*   **User:** `id, name, email, role, status`
*   **Project:** `id, title, description, status, createdAt`
*   **Section:** `id, projectId, title`
*   **TestCase:** `id, sectionId, projectId, title, priority, type, steps[], authorId, createdAt`
*   **HistoryLog:** `id, entityId, action, modifierId, changes[], timestamp`
*   **TestRun:** `id, projectId, title, status, assignedToId, caseIds[]`
*   **TestResult:** `id, runId, caseId, status, actualResult, comment, testerId, timestamp`
