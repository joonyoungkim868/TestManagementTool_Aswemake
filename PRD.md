# 상세 기획서 (Product Requirement Document)
## 내부 QA 테스트 관리 도구 (Internal QA Test Manager)

### 1. 개요 (Overview)
**제품명:** Internal QA Test Manager  
**목표:** 사내 QA 엔지니어 5인 및 외부 협력사가 사용할 수 있는 가볍고 빠른 테스트 관리 도구 (TestRail 유사).  
**핵심 가치:** 빠른 실행 속도, 철저한 변경 이력(History) 추적, 명확한 역할 기반 권한 분리, 직관적인 프로젝트 관리.  
**현재 기술 스택:** React 18, TypeScript, Tailwind CSS, Recharts, LocalStorage (Mock DB).

---

### 2. 사용자 역할 및 권한 (User Roles & Permissions)

| 역할 (Role) | 범위 (Scope) | 상세 권한 |
| :--- | :--- | :--- |
| **Admin (관리자)** | 시스템 전체 | • 사용자 관리 (초대/차단/권한변경)<br>• **프로젝트 생성/수정/보관(Archive)**<br>• 모든 테스트 케이스 및 실행에 대한 전체 접근 권한 |
| **Internal QA (내부)** | 프로젝트 전체 | • 테스트 케이스 생성/수정 (**본인 작성 케이스만 가능**)<br>• 테스트 실행(Run) 생성<br>• 테스트 수행 및 결과 입력<br>• 대시보드 및 디렉토리 조회 |
| **External (외부)** | 실행 전용 | • 할당된 프로젝트 조회<br>• 할당된 테스트 실행(Run) 수행<br>• **케이스 생성/수정 불가**<br>• **사용자 관리 접근 불가** |

---

### 3. 정보 구조 (Information Architecture)

1.  **Project Directory (프로젝트 디렉토리)** (최상위 뷰)
    *   **Project (프로젝트)** (예: "모바일 앱 2.0 배포")
        *   **Section (섹션/폴더)** (예: "로그인", "결제")
            *   **Test Case (테스트 케이스)** (개별 테스트 단위)
                *   **History Logs (변경 이력)** (수정 내역 감사 로그)
        *   **Test Run (테스트 실행)** (테스트 수행 계획)
            *   **Test Results (실행 결과)** (특정 케이스에 대한 성공/실패 기록)

---

### 4. 기능 명세 (Functional Specifications)

#### A. 프로젝트 관리 및 디렉토리 뷰 (New)
*   **프로젝트 스위처 (Sidebar):** 사이드바 상단에서 즉시 프로젝트를 전환하거나 생성할 수 있는 드롭다운 제공.
*   **디렉토리 뷰 (Directory View):** 구글 드라이브 스타일의 그리드 뷰.
    *   **Root Level:** 모든 프로젝트를 카드 형태로 표시 (프로젝트 명, 케이스 수, 생성일).
    *   **Drill-down:** 프로젝트 클릭 시 내부 섹션(폴더) 구조 확인 가능.
    *   **동작:** 특정 프로젝트의 대시보드로 진입 기능 제공.
*   **관리 기능:** 프로젝트 생성(Title, Description), 수정, 보관(Archive) 처리.

#### B. 대시보드
*   총 테스트 케이스 수, 진행 중인 실행 수, 평균 통과율, 최근 활동 그래프 제공.

#### C. 테스트 케이스 관리
*   **레이아웃:** 2단 구조 (섹션 트리 - 케이스 목록/상세).
*   **데이터 필드:** 제목, 사전조건(Markdown), 우선순위, 유형, 단계(Steps).
*   **이력 추적 (History):** 수정 시마다 변경된 필드(Diff)를 자동 기록.

#### D. 테스트 실행 (Advanced)
*   **실행 계획:** 전체 또는 선택된 케이스로 실행(Run) 생성.
*   **단계별 상태(Step Status):** 
    *   각 테스트 단계(Step)마다 Pass/Fail/Block/Retest/NA 상태 지정 가능.
    *   단계별 상태에 따라 전체 케이스 상태 자동 계산 로직 적용 (Fail 우선).
*   **실행 이력 통합:** 
    *   테스트 결과 저장 시, 해당 내역이 테스트 케이스의 History 탭에도 'EXECUTE' 액션으로 기록됨.
    *   실제 결과(Actual Result) 및 코멘트 입력.

#### E. 사용자 관리 (관리자 전용)
*   사용자 목록 조회, 역할 변경, 계정 활성/비활성화 처리.

---

### 5. 데이터 모델 (Schema)

*   **User:** `id, name, email, role, status`
*   **Project:** `id, title, description, status, createdAt`
*   **Section:** `id, projectId, title`
*   **TestCase:** `id, sectionId, projectId, title, priority, type, steps[], authorId, createdAt`
*   **HistoryLog:** `id, entityId, action ('CREATE'|'UPDATE'|'DELETE'|'EXECUTE'), modifierId, changes[], timestamp`
*   **TestRun:** `id, projectId, title, status, assignedToId, caseIds[]`
*   **TestResult:** `id, runId, caseId, status, actualResult, comment, testerId, stepResults[], timestamp`