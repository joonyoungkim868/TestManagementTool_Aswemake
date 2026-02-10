export type Role = 'ADMIN' | 'INTERNAL' | 'EXTERNAL';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type CasePriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type CaseType = 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY';
export type TestStatus = 'PASS' | 'FAIL' | 'BLOCK' | 'RETEST' | 'NA' | 'UNTESTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
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

// [NEW] Issue Interface for Defect Tracking
export interface Issue {
  id: string;
  label: string;
  url: string;
}

export interface HistoryLog {
  id: string;
  entityType: 'CASE' | 'RESULT';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXECUTE';
  modifierId: string;
  modifierName: string;
  changes: {
    field: string;
    oldVal: any;
    newVal: any;
  }[];
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
  sectionTitle?: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  title: string;
  status: 'OPEN' | 'COMPLETED';
  assignedToId?: string;
  createdAt: string;
  caseIds: string[];
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
  images?: string[];
  stepResults?: { stepId: string; status: TestStatus }[];
  issues?: Issue[]; // [NEW] Linked defects
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}