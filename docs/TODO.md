# 🛡️ QA 도구 권한 관리 및 사용자 관리 기능 구현 (TODO)

이 문서는 역할 기반 접근 제어(RBAC) 및 관리자 페이지의 사용자 관리 기능을 구현하기 위한 작업 목록입니다.

---

## 1. 역할 정의 (Role Definitions)

| 역할 (Role) | 정의 | 권한 요약 |
| :--- | :--- | :--- |
| **ADMIN** | 시스템 관리자 | **사용자 관리(계정 생성/회수) 전용**. QA 기능은 사용 가능하나 주 목적 아님. |
| **INTERNAL** | 내부 QA / 매니저 | **프로젝트의 실질적 소유자**. 프로젝트 생성, 케이스 설계, 테스트 실행 계획 수립 등 **모든 기능 수행**. |
| **EXTERNAL** | 외부 테스터 | **할당된 테스트의 실행자**. 케이스 **읽기 전용**, 실행 계획 **생성 불가** (결과 입력만 가능). |

---

## 2. 작업 목록 (To-Do List)

### 2-1. 관리자 패널 (Admin Panel) 기능 고도화
> **목표:** ADMIN 계정이 SQL이 아닌 **웹 UI**에서 사용자를 직접 관리할 수 있어야 함.

- [ ] **사용자 추가 (Create User) 기능 구현**
    - [ ] AdminPanel 상단에 '사용자 추가' 버튼 배치
    - [ ] 추가 모달 구현: 이름, 이메일, 초기 비밀번호(또는 자동생성), 역할(`INTERNAL`/`EXTERNAL`) 선택
    - [ ] Supabase `users` 테이블 `INSERT` 로직 연결 (`AuthService.createUser` 활용)

- [ ] **사용자 상태 관리 (Active/Inactive) 구현**
    - [ ] 사용자 목록에 '상태 변경' (또는 삭제/비활성화) 버튼 추가
    - [ ] `ACTIVE` <-> `INACTIVE` 토글 기능 또는 계정 삭제(`DELETE`) 기능 구현
    - [ ] (선택) 퇴사자 처리: 데이터를 남기려면 `status: 'INACTIVE'` 처리 후 로그인 로직에서 차단, 완전 삭제하려면 `DELETE` 수행.

---

### 2-2. 권한별 UI/UX 제어 (Permission Gating)
> **목표:** `EXTERNAL` 사용자에게 불필요하거나 위험한 버튼을 숨김 처리 (Render Logic 수정).

#### A. 프로젝트 관리 (Project List)
- [ ] **'새 프로젝트 생성' 버튼 제어**
    - [ ] 허용: `ADMIN`, `INTERNAL`
    - [ ] 차단(숨김): `EXTERNAL`

#### B. 테스트 케이스 관리 (Test Case Manager)
> **EXTERNAL 계정은 '읽기 전용(Read-only)' 모드로 동작해야 함.**

- [ ] **사이드바 (섹션/폴더)**
    - [ ] '섹션 추가(+)' 버튼 숨김 (`EXTERNAL`)
    - [ ] 섹션 '삭제(휴지통)' 버튼 숨김 (`EXTERNAL`)

- [ ] **케이스 목록 및 상세**
    - [ ] '케이스 추가(+)' 버튼 숨김 (`EXTERNAL`)
    - [ ] '가져오기/내보내기(Import/Export)' 버튼 중 **가져오기(Import)** 기능 차단 또는 버튼 숨김 (`EXTERNAL`)
    - [ ] 케이스 상세 화면 내 '수정(Edit)', '삭제(Delete)' 버튼 숨김 (`EXTERNAL`)
    - [ ] 케이스 내용 수정 모드 진입 불가 처리 (`EXTERNAL`)

#### C. 테스트 실행 (Test Runner)
> **EXTERNAL 계정은 '실행(Execute)'만 가능하고 '계획(Plan)'은 불가능함.**

- [ ] **실행 목록 (Run List)**
    - [ ] '실행 계획 생성(+)' 버튼 숨김 (`EXTERNAL`)

- [ ] **실행 상세 (Runner)**
    - [ ] 결과 입력(Pass/Fail) 및 코멘트 작성은 **모든 역할 허용** (기존 유지)

---

## 3. 구현 가이드 (Technical Notes)

### 유틸리티 함수 제안
권한 로직을 컴포넌트마다 `user.role === '...'`로 하드코딩하지 말고, 헬퍼 함수를 만들어 사용하는 것을 권장함.

```typescript
// utils/permissions.ts (예시)

export const canManageProject = (role: Role) => ['ADMIN', 'INTERNAL'].includes(role);
export const canManageCases = (role: Role) => ['ADMIN', 'INTERNAL'].includes(role);
export const canCreateRuns = (role: Role) => ['ADMIN', 'INTERNAL'].includes(role);
export const canManageUsers = (role: Role) => role === 'ADMIN';