# 통합 상세 기획서 (Master Product Requirement Document)
## 내부 QA 테스트 관리 도구 (Internal QA Test Manager)

---

### 1. 개요 (Overview)
* **제품 정의:** 사내 QA 팀 및 외부 협력사가 사용하는 웹 기반 테스트 케이스 관리 및 실행 도구 (TCMS).
* **핵심 가치:** "Stability & Efficiency". 대량의 테스트 케이스를 안정적으로 관리하고, 실행 속도를 극대화한다.
* **기술 스택:** React, Vite, Tailwind CSS, Supabase (Backend), Recharts.

---

### 2. 주요 기능 및 UI (Key Features)

#### A. 프로젝트 관리 (Project Management)
* **디렉토리 뷰:** 카드 그리드 형태의 프로젝트 목록 제공.
* **상태 관리:**
    * **Active:** 현재 진행 중인 프로젝트.
    * **Archived:** 종료된 프로젝트 (읽기 전용 성격).
* **CRUD:** 프로젝트 생성, 수정, 삭제(Cascade Delete 적용) 기능.

#### B. 테스트 케이스 관리 (Test Case Manager)
* **구조:** 좌측 섹션(폴더) 트리 / 우측 케이스 리스트 및 상세 편집의 2-Pane 레이아웃.
* **정렬(Sorting) [중요]:**
    * **`seq_id` (Serial) 기반 정렬:** 케이스 생성 시 부여되는 고유 일련번호를 기준으로 정렬하여, 수정 시에도 순서가 뒤섞이지 않도록 보장.
* **데이터 관리 (Import/Export):**
    * **CSV Import:** 파일 업로드 시 텍스트 파싱 -> 컬럼 자동 감지(Smart Detection) -> 필드 매핑 -> 대량 등록.
    * **Backup:** CSV 및 JSON 내보내기 지원.
* **변경 이력 (History & Audit):**
    * **Diff Viewer:** 수정 시 변경 전/후 데이터를 비교하여 시각적으로 표시 (Steps 변경 사항 하이라이팅).
    * 작성자, 수정일시 자동 기록.

#### C. 테스트 실행 (Test Runner)
* **실행 계획 (Test Run):**
    * 전체 케이스 또는 특정 섹션/케이스를 선택하여 실행 계획 생성.
* **실행 인터페이스 (Execution UI):**
    * **단계별 실행:** 각 Step 별 Pass/Fail 처리 가능.
    * **퀵 액션 (Pass & Next):** 버튼 클릭 시 '성공' 저장 및 다음 케이스로 즉시 이동 (로딩 인디케이터 및 중복 클릭 방지 적용).
    * **결함 추적:** 실패 시 결함(Issue) 라벨 및 외부 트래커 URL(Jira 등) 입력 필드 제공.
* **동기화:** 케이스 디렉토리와 동일한 `seq_id` 정렬을 적용하여 일관된 실행 순서 제공.

#### D. 대시보드 및 리포트 (Dashboard & Reporting)
* **실시간 대시보드:**
    * KPI: 총 케이스, 활성 실행 수, 통과율(Pass Rate), 결함 수.
    * 트렌드: 최근 7일간의 테스트 활동(Pass/Fail) 막대 차트.
* **상세 리포트 (Report Modal):**
    * 특정 Test Run을 선택하여 상세 분석.
    * 파이 차트(Status Distribution) 및 발견된 결함 목록 요약.

---

### 3. 데이터 모델 (Data Schema)

| 엔티티 | 설명 및 주요 필드 |
| :--- | :--- |
| **User** | 사용자 정보 (`role`: ADMIN/INTERNAL/EXTERNAL). |
| **Project** | 최상위 관리 단위 (`status`: ACTIVE/ARCHIVED). |
| **Section** | 케이스 그룹화 폴더. |
| **TestCase** | 테스트 시나리오 원본. **`seq_id` (SERIAL) 필드 필수 (정렬용).** |
| **TestRun** | 실행 계획. 대상 케이스 ID 배열(`caseIds`) 포함. |
| **TestResult** | 실행 결과. `runId`와 `caseId`의 조합. Step별 결과 및 이력(`history`) 포함. |
| **HistoryLog** | 데이터 변경 감사 로그 (JSONB Diff 저장). |

---

### 4. 권한 정책 (RBAC)
* **ADMIN:** 모든 기능 접근 및 **사용자 관리(Admin Panel)** 가능.
* **INTERNAL:** 프로젝트 생성/수정, 케이스 설계, 실행 가능.
* **EXTERNAL:** 할당된 테스트 실행(Result 입력)만 가능 (프로젝트/케이스 구조 변경 불가).