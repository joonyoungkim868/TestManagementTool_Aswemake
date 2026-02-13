export type Role = 'ADMIN' | 'INTERNAL' | 'EXTERNAL';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type TestStatus = 'PASS' | 'FAIL' | 'BLOCK' | 'NA' | 'UNTESTED';
export type CasePriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type CaseType = 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus; // [수정] 이 부분이 추가되어야 합니다.
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface Section {
  id: string;
  projectId: string;
  title: string;
  parentId?: string | null;
}

export interface TestStep {
  id: string;
  step: string;
  expected: string;
}

export interface Issue {
  id: string;
  label: string;
  url: string;
}

export interface HistoryLog {
  id: string;
  entityType?: 'CASE' | 'RESULT'; // Optional로 변경하거나 storage.ts 로직에 맞춤
  entityId: string;
  action: string; // 'CREATE' | 'UPDATE' ... 등 유연하게 처리
  modifierId: string; // 혹은 modifierName 등
  modifierName: string;
  changes: any[];
  timestamp: string;
}

export interface TestCase {
  id: string;
  sectionId: string;
  projectId: string;
  title: string;
  precondition: string;
  steps: TestStep[];
  priority: CasePriority;
  type: CaseType;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  sectionTitle?: string; // UI용 확장 필드
  seq_id?: number; // 정렬용 시퀀스 ID
}

export interface TestRun {
  id: string;
  projectId: string;
  title: string;
  status: 'OPEN' | 'COMPLETED';
  assignedToId?: string;
  createdAt: string;
  caseIds: string[];
  seq_id?: number; // 정렬용 시퀀스 ID
}

export interface ExecutionHistoryItem {
  status: TestStatus;
  actualResult: string;
  comment: string;
  testerId: string;
  timestamp: string;
  issues?: Issue[];
  stepResults?: { stepId: string; status: TestStatus }[];
}

export interface TestResult {
  id: string;
  runId: string;
  caseId: string;
  status: TestStatus;
  actualResult: string;
  comment: string;
  testerId: string;
  timestamp: string;
  stepResults?: { stepId: string; status: TestStatus }[];
  issues?: Issue[];
  history?: ExecutionHistoryItem[];
}