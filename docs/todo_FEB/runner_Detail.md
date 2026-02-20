📱 [PRD 업데이트] Runner 리스트 및 생성 화면 기획
1. Runner List View (조회 및 검색 UI/UX Flow)
[목표] 테스터가 진입하자마자 **'내가 참여 중인 활성 테스트'**를 직관적으로 확인하고, NA 상태를 포함한 정확한 진행률을 파악할 수 있어야 합니다.

A. 화면 레이아웃
상단 헤더: 페이지 타이틀 (Test Runs) 및 [+ 새 실행 계획 생성] 버튼.

필터/검색 바 (Filter Bar): 리스트 조회를 제어하는 컨트롤 패널.

리스트 영역: 카드(Card) 형태의 Runner 목록.

B. 필터/검색 바 (Filter UI)
상태 토글 (Status): [진행 중 (Active)] / [종료됨 (Completed)]

담당자 드롭다운 (Assignee):

기본값: 내 작업 (Assigned to me) - 복수 담당자 중 내가 1명이라도 포함되어 있으면 노출됨.

옵션: 전체 (All), 팀원 A, 팀원 B...

테스트 단계 드롭다운 (Phase):

기본값: 전체 단계 (All Phases)

옵션: 생성된 모든 Phase 목록들을 동적으로 불러와 노출 (예: Dev, Stage, Service, 핫픽스 등)

검색어 입력창 (Search Input): 제목 텍스트 기반 검색.

C. 리스트 뷰 아이템 (Card Data)
Title: (예: [3월 정기배포] 로그인/결제 회귀 테스트)

Phase Badge: 입력된 Phase 값에 따른 뱃지 노출 (Dev, Stage, Service 및 커스텀 텍스트)

[업데이트] Progress Bar (진행률 바):

100% 게이지 기준, 상태별 누적 막대 그래프

🟩 Pass / 🟥 Fail / ⬛ Block / 🟧 NA(N/A) / ⬜ Untested

NA가 반영되어, 테스트를 건너뛴 항목이 있어도 전체 100%가 꽉 찬 것으로 시각적 인지 가능.

Assignees (담당자): 팀원 프로필 아이콘들이 겹쳐진 형태(Avatar Group)로 다수 표시됨.

생성일: YYYY-MM-DD

2. 신규 Runner 제작 화면 (Creation UI/UX Flow)
[목표] Drive(Manager)에 흩어져 있는 테스트케이스 문서들을 빠르게 선택하고, 유연한 메타 정보(커스텀 Phase, 복수 담당자)를 부여하여 테스트를 세팅합니다.

A. 진입 및 UI 형태
진입: 리스트 뷰 우측 상단 [+ 새 실행 계획 생성] 버튼 클릭.

형태: 우측에서 슬라이드되어 나오는 넓은 Drawer (사이드 패널).

B. Step-by-Step Flow
[Step 1] 기본 정보 입력 (Meta Info)

제목 (Title): 텍스트 입력창 (필수)

[업데이트] 테스트 단계 (Phase): 콤보박스(Combobox) 형태

클릭 시 기본 추천 목록(Dev, Stage, Service) 드롭다운 표시.

사용자가 직접 키보드로 새로운 텍스트(예: 핫픽스, QA-2차)를 타이핑하여 생성 및 선택 가능 (필수).

[업데이트] 담당자 (Assignees): 다중 선택 드롭다운 (Multi-select)

디폴트 값: **'Runner를 생성하는 본인'**이 자동 선택되어 있음.

추가로 팀원들을 체크박스로 여러 명 선택 가능.

설명/목표 (Description): (선택) 간단한 텍스트 영역

[Step 2] 테스트케이스 파일 선택 (Document Selection)

좌측 (Folder Tree): Drive에 생성해둔 N-Depth 폴더 구조 트리.

우측 (File List): 폴더 클릭 시 나타나는 하위 테스트케이스 문서(파일) 목록 및 체크박스(☑️).

선택 현황 (Selection Bar): 하단 고정 바에 "선택된 문서: N개" 표시 및 선택 해제할 수 있는 Chip(태그) 제공.

[Step 3] 생성 완료

[실행 계획 생성] 버튼 클릭.

Drawer가 닫히고, 상태가 Active인 상태로 Runner 리스트 최상단에 방금 만든 카드가 렌더링됨.