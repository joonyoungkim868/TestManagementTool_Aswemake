# 통합 상세 기획서 (Master Product Requirement Document)
## 내부 QA 테스트 관리 도구 (Internal QA Test Manager)

---

### 1. 개요 (Overview)
*   **제품 정의:** 사내 QA 팀 및 외부 협력사가 사용하는 웹 기반 테스트 케이스 관리 및 실행 도구 (TCMS).
*   **핵심 철학:** "Click-to-Value". 복잡한 설정 없이 즉시 케이스를 작성하고, 실행하고, 결과를 리포팅할 수 있어야 한다.
*   **타겟 유저:**
    *   **Admin:** 프로젝트 및 인력 관리.
    *   **Internal QA:** 테스트 설계(Case Design) 및 실행 주도.
    *   **External Tester:** 할당된 테스트 실행(Execution)만 수행.

---

### 2. 전역 UI 및 네비게이션 (Global UI & Navigation)

#### 2.1 사이드바 (Sidebar)
*   **기능:** 애플리케이션의 메인 네비게이션.
*   **구성 요소:**
    *   **프로젝트 스위처 (Project Switcher):**
        *   *동작:* 상단 드롭다운 클릭 시 활성 프로젝트 목록 노출. 선택 시 즉시 해당 프로젝트 컨텍스트로 전환.
        *   *기획 의도:* QA 엔지니어는 여러 프로젝트를 동시에 담당하므로, Depth 이동 없이 프로젝트 간 빠른 전환이 필수적임.
    *   **메뉴:** 대시보드 / 테스트 케이스 / 테스트 실행 / 사용자 관리(Admin Only).
    *   **로그아웃:** 하단 고정.

#### 2.2 인증 (Authentication)
*   **방식:** 이메일 기반 간편 로그인 (Mock Auth).
*   **계정 정책:**
    *   Admin (`admin@company.com`): 모든 권한.
    *   Internal (`jane@company.com`): 프로젝트 내 쓰기 권한.
    *   External (`ext@vendor.com`): 실행(Read/Execute) 권한만 보유.

---

### 3. 기능 명세 상세 (Detailed Functional Specifications)

#### A. 프로젝트 디렉토리 (Home / Directory View)
*   **진입점:** 사이드바 프로젝트 스위처 하단 '모든 프로젝트 보기' 또는 앱 최초 진입 시.
*   **UI 구성:** 카드 그리드 레이아웃.
*   **기능 상세:**
    1.  **프로젝트 카드:** 프로젝트명, 설명(2줄 말줄임), 생성일, 상태 아이콘 표시.
    2.  **프로젝트 생성:** 모달을 통해 제목, 설명 입력. 생성 즉시 'ACTIVE' 상태로 시작.
    3.  **상태 관리 (Active/Archived):** 완료된 프로젝트는 아카이빙하여 목록을 깔끔하게 유지. 아카이브된 프로젝트는 읽기 전용으로 전환되거나 UI 색상이 흐려짐.

#### B. 대시보드 (Dashboard)
*   **목적:** 프로젝트의 현재 품질 상태를 한눈에 파악.
*   **주요 위젯:**
    1.  **KPI 카드:** 총 케이스 수, 진행 중인 실행(Run) 수, 평균 통과율, 오픈된 결함 수.
    2.  **활동 그래프:** 최근 7일간의 테스트 수행 추이 (Pass/Fail 막대 차트).
*   **리포트 생성 (Report Modal):**
    *   *동작:* '보고서 생성' 버튼 클릭 -> 특정 테스트 실행(Test Run) 선택 -> 결과 분석 화면 출력.
    *   *출력 내용:* 파이 차트(Pass/Fail/Untested), 상태별 카운트, **발견된 결함(Defects) 목록 및 링크**.
    *   *기획 의도:* 개발팀이나 PM에게 테스트 결과를 공유할 때, 캡처 한 번으로 현황을 공유할 수 있는 포맷 제공.

#### C. 테스트 케이스 관리 (Test Case Manager)
*   **레이아웃:** 2-Pane (좌측: 섹션 트리 / 우측: 케이스 목록 및 상세).
*   **1. 섹션(폴더) 관리:**
    *   기능: 생성, 선택 필터링.
    *   *의도:* 기능 단위(로그인, 결제, 마이페이지 등)로 케이스를 그룹화하여 관리 효율성 증대.
*   **2. 케이스 목록:**
    *   표시 정보: 제목, 우선순위(Badge), 유형(Badge).
    *   선택 시 우측 상세 패널에 내용 로드.
*   **3. 케이스 상세/수정:**
    *   **필드:**
        *   제목 (Title)
        *   사전 조건 (Precondition): 멀티라인 텍스트.
        *   우선순위 (Priority): High/Medium/Low.
        *   유형 (Type): Functional/UI/Performance/Security.
        *   **테스트 단계 (Test Steps):** `[행동(Action)]` - `[기대결과(Expected)]` 쌍으로 구성된 동적 리스트.
    *   **변경 이력 (History Log):**
        *   *동작:* 저장 시 이전 데이터와 현재 데이터를 비교(Diff)하여 변경된 필드를 자동으로 기록. "누가, 언제, 무엇을 변경했는지" 감사 로그 제공.
*   **4. 데이터 가져오기/내보내기 (Import/Export Wizard):**
    *   **내보내기:** CSV 및 JSON 포맷 지원.
    *   **가져오기 (CSV):**
        *   *1단계:* 파일 업로드 또는 텍스트 붙여넣기.
        *   *2단계 (Smart Mapping):* 업로드된 CSV 헤더와 시스템 필드(Title, Step, Priority 등)를 매핑. 한국어(제목, 중요도, 절차 등) 자동 인식 지원.
        *   *3단계 (Preview):* 매핑 결과 미리보기 (빈 행 건너뛰기 로직 포함).

#### D. 테스트 실행 (Test Runner) - [UI/UX 대규모 개선]
*   **목적:** 실제 테스트를 수행하고 결과를 기록하는 핵심 워크플로우.

**1. 실행 목록 (Test Run List)**
*   **표시 정보:** 실행 제목, 생성일, **진행률 바(Progress Bar)**.
*   **[New] 스택형 프로그레스 바 (Stacked Progress Bar):**
    *   단순 % 숫자가 아닌, 전체 케이스 대비 상태 비율을 시각적으로 표현.
    *   디자인: `[초록(Pass)][빨강(Fail)][회색/투명(Untested)]` 형태의 가로 바.
    *   *기획 의도:* 목록 진입 전에도 해당 실행의 건전성(Health)과 진척도를 직관적으로 인지하기 위함.

**2. 실행 상세 (Run Detail Dashboard)**
*   **[New] 미니 대시보드 (Mini Dashboard):**
    *   위치: 상세 화면 상단.
    *   내용: **파이 차트(Pie Chart)** + 상태별 개수 카운터.
    *   *기획 의도:* 현재 테스트 실행의 남은 잔여량과 현재 이슈 비율을 즉시 확인.
*   **[New] 컴팩트 리스트 (Compact List Style):**
    *   케이스 리스트의 폰트 사이즈와 행간을 줄여, 한 화면에 더 많은 케이스가 보이도록 개선. (스크롤 최소화).

**3. 러너 인터페이스 (Execution Interface)**
*   **진입:** 케이스 선택 시 실행 모드(Runner Mode) 활성화.
*   **기능 1: 상태 처리 (Status Handling):**
    *   **[New] 상태 코드 표준화:** 기존 한글 상태를 시스템 코드로 통일 (`PASS`, `FAIL`, `BLOCKED`, `N/A`).
    *   **[New] 시각적 피드백 (Visual Feedback):** 상태 선택 시, 결과 입력 컨테이너의 **테두리(Border) 색상**이 변경됨.
        *   PASS -> Green / FAIL -> Red / BLOCKED -> Black / N/A -> Orange.
*   **기능 2: 결과 입력:**
    *   실제 결과(Actual Result), 코멘트(Comment) 텍스트 필드.
    *   **[New] 결함(Defect) 입력 필드 분리:**
        *   기존: 단일 Input.
        *   변경: **이슈 명(Label)**과 **링크(URL)** 필드 분리.
        *   *이유:* Jira/Redmine 등 외부 이슈 트래커 URL을 명확히 관리하고, 리포트에서 바로 이동할 수 있게 하기 위함.
*   **기능 3: 액션 버튼:**
    *   저장 (Save): 현재 상태 저장.
    *   **[New] Pass & Next (퀵 액션):**
        *   *동작:* 버튼 클릭 시 **현재 케이스를 'PASS'로 즉시 저장**하고, **자동으로 다음 케이스로 이동**.
        *   *기획 의도:* 반복적인 성공 케이스 입력 시 클릭 피로도 감소 (Click reduction).

#### E. 관리자 패널 (Admin Panel)
*   **접근 권한:** Role이 'ADMIN'인 사용자만 접근 가능.
*   **사용자 목록:** 이름, 이메일, 현재 권한, 계정 상태(Active/Inactive) 표시.
*   **권한 관리:** 사용자의 역할을 변경하거나, 퇴사자 발생 시 계정을 비활성화(Soft Delete) 처리.

---

### 4. 데이터 모델 설계 (Data Schema)

| 엔티티 (Entity) | 주요 필드 (Fields) | 설명 |
| :--- | :--- | :--- |
| **User** | `id`, `email`, `role`, `status` | 사용자 계정 및 권한 정보. |
| **Project** | `id`, `title`, `status` (`ACTIVE`/`ARCHIVED`) | 최상위 관리 단위. |
| **Section** | `id`, `projectId`, `title` | 케이스를 묶는 폴더 개념. |
| **TestCase** | `id`, `steps`(`[{step, expected}]`), `priority`, `type` | 테스트 시나리오 원본. |
| **TestRun** | `id`, `caseIds`(`string[]`), `status` | 특정 시점의 테스트 실행 계획 (스냅샷 아님, ID 참조). |
| **TestResult** | `id`, `runId`, `caseId`, `status`, `issues`(`[{label, url}]`) | 특정 실행 내 케이스의 수행 결과. |
| **HistoryLog** | `id`, `entityId`, `changes`(`[{field, old, new}]`) | 데이터 변경 감사 로그. |

---

### 5. 비기능 요구사항 (Non-Functional Requirements)
*   **성능:** 모든 데이터 조작은 로컬 스토리지 내에서 100ms 이내에 반응해야 한다.
*   **데이터 무결성:** 케이스 수정 시 이력(History)은 절대 누락되어서는 안 된다.
*   **확장성:** 추후 실제 백엔드(DB) 연동 시 `storage.ts` 레이어만 교체하면 되도록 구조화한다.
