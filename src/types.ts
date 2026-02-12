export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER' | 'VIEWER';
}

export interface Project {
    id: string;
    title: string;
    description: string;
    status: ProjectStatus;
    createdAt: string;
    updatedAt: string;
}

export interface Section {
    id: string;
    projectId: string;
    title: string;
}

export interface TestStep {
    id: string;
    step: string;
    expected: string;
}

export interface TestCase {
    id: string;
    projectId: string;
    sectionId: string;
    title: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    type: 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY';
    precondition: string;
    steps: TestStep[];
    authorId: string;
    createdAt: string;
    updatedAt: string;
}

export interface TestRun {
    id: string;
    projectId: string;
    title: string;
    caseIds: string[];
    createdAt: string;
}

export type TestStatus = 'PASS' | 'FAIL' | 'BLOCK' | 'NA' | 'UNTESTED';

export interface Issue {
    id: string;
    label: string;
    url: string;
}

export interface TestResult {
    id: string;
    runId: string;
    caseId: string;
    testerId: string;
    status: TestStatus;
    actualResult: string;
    comment: string;
    issues: Issue[];
    stepResults?: { stepId: string, status: TestStatus }[]; // Step 별 결과
    history?: ExecutionHistoryItem[]; // 실행 이력 (같은 Run 내에서 재테스트)
    updatedAt: string;
}

export interface ExecutionHistoryItem {
    status: TestStatus;
    actualResult: string;
    comment: string;
    testerId: string;
    timestamp: string;
    issues: Issue[];
    stepResults?: { stepId: string, status: TestStatus }[];
}

export interface HistoryChange {
    field: string;
    oldVal: any;
    newVal: any;
}

export interface HistoryLog {
    id: string;
    targetId: string; // Case ID or Project ID
    modifierId: string;
    modifierName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    changes: HistoryChange[];
    timestamp: string;
    version: number;
}
