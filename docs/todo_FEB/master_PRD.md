🚀 [Master PRD] QA Test Manager 서비스 전면 개편 기획서 (A/B Test Branch)
1. 개편 배경 및 목표 (Overview)
배경: 기존 '프로젝트' 단위의 1-Depth 구조는 일회성 테스트에는 적합하나, 지속적인 테스트 케이스의 버전 관리 및 산출물(Asset) 아카이빙에는 한계가 존재함.

목표:

구글 드라이브 형태의 '문서(Document) 중심 아카이빙' 구조 도입 (테스트 자산화).

테스트 실행(Runner)을 프로젝트 종속에서 벗어나, **'할당된 Task 중심'**으로 개편하여 업무 효율성 극대화.

기존 구조(A)와 신규 구조(B)의 A/B 테스트를 위한 신규 브랜치 개발.

2. 서비스 구조 및 Flow 변경점 (Service & IA Changes)
2-1. GNB / 사이드바 네비게이션 개편
기존: 특정 'Project'를 먼저 선택해야만 하위 메뉴(대시보드, 케이스, 실행)가 열리는 프로젝트 종속형 네비게이션.

변경: 프로젝트 선택 개념이 완전히 사라짐. 기능 중심의 독립형 탭으로 개편.

📁 Drive (테스트 자산 관리): 폴더/문서 탐색 및 케이스 생성/수정 (기존 Manager 대체)

🚀 Test Runs (실행 및 추적): 진행 중이거나 종료된 테스트 Task 목록 및 실행 (기존 Runner 개편)

📊 Reports (대시보드): (Drive나 Runner 내부에서 Contextual하게 접근하도록 통합하거나 별도 탭 유지)

⚙️ Admin (관리자): 사용자 및 권한 관리 (유지)

2-2. 주요 도메인 개념의 치환
Project (기존) ➡️ Document (신규): 기존의 1개 프로젝트가 1개의 '문서(파일)' 개념으로 축소 및 변경됨.

Project List (기존) ➡️ Folder Tree (신규): 문서들을 묶고 분류하는 N-Depth 형태의 '폴더' 개념 신설.

3. 핵심 화면 개편 요약 (Core Features)
[상세 기획 참고 - Drive_Detail.md] Drive 탭 (기존 Manager 대체):

N-Depth 폴더 및 문서 트리 탐색 UI.

문서 '복사본 만들기'를 통한 버전 관리 및 스냅샷 보존 지원.

문서 더블 클릭 시 나타나는 에디터(기존 TestCaseManager 뷰)는 100% 동일하게 유지.

[상세 기획 참고 - runner_Detail.md] Test Runs 탭 (Runner 개편):

[상태: 활성/종료], [담당자], [테스트 단계(Phase)] 필터링 기반의 Task 리스트 뷰.

NA가 포함된 진행률 막대(Progress Bar) 표시.

우측 Drawer 형태의 신규 Runner 생성 모달 (Drive 트리에서 다중 문서 선택, Phase 커스텀 입력 지원).

테스트 종료 시 스냅샷(Snapshot) 데이터 동결 처리.

4. 데이터베이스(DB) 구조 변경 계획 (Schema Migration)
전체적인 Entity 관계가 Project -> TestCase 에서 Folder -> Document -> TestCase 로 변경됨에 따라 스키마 개편이 필수적입니다.

4-1. 신규 및 변경 테이블
folders (신규 테이블)

id (UUID, PK)

name (TEXT): 폴더명

parent_id (UUID, FK -> folders.id): 상위 폴더 ID (최상위는 null)

createdAt (TIMESTAMP)

documents (신규 테이블 - 기존 projects 대체)

id (UUID, PK)

folder_id (UUID, FK -> folders.id): 소속 폴더

title (TEXT): 문서 제목

description (TEXT): 문서 설명

createdAt (TIMESTAMP)

testCases (변경 테이블)

projectId 필드 삭제 ➡️ document_id (UUID, FK -> documents.id) 추가

testRuns (변경 테이블)

projectId 필드 삭제 (이제 Runner는 특정 프로젝트에 종속되지 않음)

documentIds (JSONB 배열): 선택된 타겟 문서 ID 목록 추가.

phase (TEXT): 테스트 단계 (Dev, Stage, Service, 커스텀 텍스트 등) 추가.

assignees (JSONB 배열): 복수 담당자 ID 목록 추가.

status (TEXT): ACTIVE(진행중) / COMPLETED(종료)

snapshot_data (JSONB): COMPLETED 상태 전환 시, 연동된 TestCase 원본 데이터 전체를 복사하여 영구 보존할 필드.

5. 코드베이스 디렉토리 구조 변경안 (Directory Restructuring)
새로운 개념(Drive, Document)에 맞게 src/components/ 하위 디렉토리를 정리합니다.

Plaintext

src/components/
 ├─ layout/
 │   ├─ MainLayout.tsx     (프로젝트 상태 관리 제거, 라우팅만 처리)
 │   └─ Sidebar.tsx        (기능 탭 형태의 정적 네비게이션으로 변경)
 ├─ drive/                 [기존 project 폴더 대체]
 │   ├─ DriveExplorer.tsx  (폴더/파일 트리 뷰 및 CRUD)
 │   └─ DocumentModal.tsx  (새 문서/폴더 생성 모달)
 ├─ test-case/             [유지하되 종속성 변경]
 │   ├─ TestCaseManager.tsx (단일 Document 데이터를 받아 렌더링하도록 수정)
 │   └─ ...
 ├─ test-run/              [전면 개편]
 │   ├─ RunnerList.tsx     (신규 리스트 뷰 및 필터 바)
 │   ├─ RunCreationDrawer.tsx (신규 Drawer: 트리 탐색 및 다중 문서 선택)
 │   └─ TestRunner.tsx     (기존 뷰 유지하되, 완료 시 스냅샷 처리 로직 추가)
6. 기존 코드베이스 영향도 분석 (Impact Analysis)
이번 개편으로 인해 기존 코드에서 반드시 뜯어고쳐야 하는 영향 범위입니다.

6-1. 라우팅 및 전역 상태 (App.tsx, MainLayout.tsx)
영향: 기존 코드는 URL 파라미터(/:projectId/cases)와 Outlet Context를 통해 activeProject를 전역으로 뿌려주고 있었습니다.

수정: 전역 Project 상태를 완전히 걷어냅니다. 라우팅은 /drive, /runs, /admin 형태로 평탄화(Flatten)되어야 합니다.

6-2. 스토리지 및 API 레이어 (src/storage.ts, src/types.ts)
영향: ProjectService가 소멸하고 DriveService(Folder/Document)로 대체되어야 합니다.

수정: TestCaseService.getCases가 projectId 대신 documentId를 파라미터로 받도록 변경해야 합니다.

수정: RunService의 CRUD 로직에 phase, assignees, 다중 documentIds 처리 및 COMPLETED 시 스냅샷 저장 로직(JSON 덤프)을 추가해야 합니다.

6-3. UI 컴포넌트 종속성 제거
TestCaseManager.tsx: 기존에는 project={activeProject}를 Props로 받아 작동했습니다. 이제는 DriveExplorer에서 더블클릭된 document 객체를 Props로 받아 렌더링되도록 진입점을 변경해야 합니다.

Sidebar.tsx: 상단의 '프로젝트 선택 드롭다운' 컴포넌트를 완전히 삭제하고, 내 프로필 및 전체 메뉴(Drive, Runs 등)만 노출되도록 디자인을 단순화해야 합니다.

6-4. 대시보드 (Dashboard.tsx)
영향: 기존에는 글로벌 프로젝트 단위로 취합했습니다.

수정: 글로벌 대시보드 탭을 제거하고, ReportModal.tsx처럼 Drive에서 특정 폴더나 문서를 선택했을 때 해당 Context에 맞는 통계만 쿼리해오도록 쿼리 로직을 documentIds 기반으로 재작성해야 합니다.