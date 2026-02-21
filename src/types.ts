export type Role = 'ADMIN' | 'INTERNAL' | 'EXTERNAL';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'; // Deprecated but kept for type compatibility during migration if needed
export type TestStatus = 'PASS' | 'FAIL' | 'BLOCK' | 'NA' | 'UNTESTED';
export type CasePriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type CaseType = 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY';
export type PlatformType = 'WEB' | 'APP';
export type DevicePlatform = 'PC' | 'iOS' | 'Android';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}

// [NEW] Folder Interface
export interface Folder {
  id: string;
  name: string;
  desc?: string;
  parentId: string | null; // Root folders have null
  createdAt: string;
}

// [NEW] Document Interface (Replaces Project)
export interface Document {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  documentId: string; // [CHANGED] projectId -> documentId
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
  entityType?: 'CASE' | 'RESULT';
  entityId: string;
  action: string;
  modifierId: string;
  modifierName: string;
  changes: any[];
  timestamp: string;
}

export interface TestCase {
  id: string;
  sectionId: string;
  documentId: string; // [CHANGED] projectId -> documentId
  title: string;
  precondition: string;
  steps: TestStep[];
  priority: CasePriority;
  type: CaseType;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  sectionTitle?: string;
  seq_id?: number;
  note?: string;
  platform_type?: PlatformType;
}

export interface TestRun {
  id: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'COMPLETED';

  // [CHANGED] Multi-document support
  target_document_ids: string[]; // JSONB array in DB

  // [NEW] Metadata
  phase: string;
  assignees: string[]; // User IDs

  // [NEW] Snapshot
  snapshot_data?: any; // Full dump of state at completion

  createdAt: string;
  completedAt?: string;
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
  device_platform?: DevicePlatform;
}