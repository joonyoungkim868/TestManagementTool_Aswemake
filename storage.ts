import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, TestStep, Issue 
} from './types';

/**
 * [DB_MIGRATION] 가이드 (DB 연동 시 필독)
 * 
 * 이 파일은 현재 브라우저의 localStorage를 사용하여 데이터베이스를 흉내(Mocking) 내고 있습니다.
 * 실제 운영 환경(Production)으로 전환하기 위해서는 아래 절차를 따르세요:
 * 
 * 1. 모든 `localStorage.getItem/setItem` 호출을 실제 백엔드 API 호출(`fetch` 또는 `axios`)로 교체하세요.
 * 2. `getItems` 함수 -> GET /api/{resource} 로 교체
 * 3. `saveItem` 함수 -> POST /api/{resource} (생성) 또는 PUT /api/{resource}/{id} (수정) 로 교체
 * 4. 특히 `HistoryLog` (변경 이력) 생성 로직은 데이터 무결성을 위해 반드시 프론트엔드가 아닌 "서버(Backend)"에서 처리해야 합니다.
 */

const STORAGE_KEYS = {
  USERS: 'app_users',
  PROJECTS: 'app_projects',
  SECTIONS: 'app_sections',
  CASES: 'app_cases',
  RUNS: 'app_runs',
  RESULTS: 'app_results',
  HISTORY: 'app_history',
  CURRENT_USER: 'app_current_user',
};

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// --- Initial Seed Data (초기 데이터) ---
const seedData = () => {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const users: User[] = [
        { id: 'u1', name: '관리자(Admin)', email: 'admin@company.com', role: 'ADMIN', status: 'ACTIVE' },
        { id: 'u2', name: '김철수(QA)', email: 'jane@company.com', role: 'INTERNAL', status: 'ACTIVE' },
        { id: 'u3', name: '이영희(파트너)', email: 'ext@vendor.com', role: 'EXTERNAL', status: 'ACTIVE' },
      ];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
      const projects: Project[] = [
          { id: 'p1', title: 'Q2 웹사이트 개편', description: '메인 홈페이지 리뉴얼 프로젝트', status: 'ACTIVE', createdAt: now() }
      ];
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  } catch (e) {
    console.warn("Storage access blocked or full");
  }
};

// Initialize
try {
  seedData();
} catch (e) {
  console.error("Failed to seed data", e);
}

// --- Generic DB Operations (Simulated) ---

// [DB_MIGRATION]: API GET 호출로 교체 필요
function getItems<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Error parsing data for key ${key}`, error);
    // 데이터 손상 시 빈 배열 반환하여 앱 충돌 방지
    return [];
  }
}

// [DB_MIGRATION]: API POST/PUT 호출로 교체 필요
function saveItems<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.error(`Error saving data for key ${key}`, error);
    alert("브라우저 저장 공간이 부족하거나 오류가 발생했습니다.");
  }
}

// --- Specific Services ---

export const AuthService = {
  login: (email: string): User | null => {
    // [DB_MIGRATION]: POST /api/auth/login
    const users = getItems<User>(STORAGE_KEYS.USERS);
    const user = users.find(u => u.email === email && u.status === 'ACTIVE');
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },
  logout: () => {
    // [DB_MIGRATION]: POST /api/auth/logout
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },
  getCurrentUser: (): User | null => {
    // [DB_MIGRATION]: GET /api/auth/me
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      const user = JSON.parse(data);
      // Basic validation
      if (user && user.id && user.email) return user;
      return null;
    } catch (e) {
      return null;
    }
  },
  getAllUsers: (): User[] => getItems<User>(STORAGE_KEYS.USERS),
  updateUser: (user: User) => {
    // [DB_MIGRATION]: PUT /api/users/:id
    const users = getItems<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      saveItems(STORAGE_KEYS.USERS, users);
    }
  },
  createUser: (user: User) => {
     // [DB_MIGRATION]: POST /api/users
     const users = getItems<User>(STORAGE_KEYS.USERS);
     users.push(user);
     saveItems(STORAGE_KEYS.USERS, users);
  }
};

export const ProjectService = {
  getAll: (): Project[] => getItems<Project>(STORAGE_KEYS.PROJECTS),
  create: (project: Omit<Project, 'id' | 'createdAt'>) => {
    // [DB_MIGRATION]: POST /api/projects
    const projects = getItems<Project>(STORAGE_KEYS.PROJECTS);
    const newProject: Project = { ...project, id: generateId(), createdAt: now() };
    projects.push(newProject);
    saveItems(STORAGE_KEYS.PROJECTS, projects);
    return newProject;
  },
  // [NEW] Update project (Edit/Archive)
  update: (project: Project) => {
    // [DB_MIGRATION]: PUT /api/projects/:id
    const projects = getItems<Project>(STORAGE_KEYS.PROJECTS);
    const index = projects.findIndex(p => p.id === project.id);
    if (index !== -1) {
      projects[index] = project;
      saveItems(STORAGE_KEYS.PROJECTS, projects);
      return project;
    }
    return null;
  }
};

export const TestCaseService = {
  getSections: (projectId: string): Section[] => {
    // [DB_MIGRATION]: GET /api/projects/:id/sections
    return getItems<Section>(STORAGE_KEYS.SECTIONS).filter(s => s.projectId === projectId);
  },
  createSection: (section: Omit<Section, 'id'>) => {
    const sections = getItems<Section>(STORAGE_KEYS.SECTIONS);
    const newSection = { ...section, id: generateId() };
    sections.push(newSection);
    saveItems(STORAGE_KEYS.SECTIONS, sections);
    return newSection;
  },
  getCases: (projectId: string): TestCase[] => {
    // [DB_MIGRATION]: GET /api/projects/:id/cases
    return getItems<TestCase>(STORAGE_KEYS.CASES).filter(c => c.projectId === projectId);
  },
  
  // 변경 이력(History)을 처리하는 중요한 함수입니다.
  saveCase: (caseData: Partial<TestCase>, modifier: User) => {
    // [DB_MIGRATION]: POST/PUT /api/cases (아래 로직은 반드시 백엔드로 이동해야 함)
    const cases = getItems<TestCase>(STORAGE_KEYS.CASES);
    const existingIndex = cases.findIndex(c => c.id === caseData.id);
    
    if (existingIndex > -1) {
      // UPDATE (수정)
      const oldCase = cases[existingIndex];
      const newCase = { ...oldCase, ...caseData, updatedAt: now() };
      
      // 변경 사항 추적 (Diff 계산)
      const changes: HistoryLog['changes'] = [];
      if (oldCase.title !== newCase.title) changes.push({ field: '제목(Title)', oldVal: oldCase.title, newVal: newCase.title });
      if (oldCase.priority !== newCase.priority) changes.push({ field: '우선순위(Priority)', oldVal: oldCase.priority, newVal: newCase.priority });
      if (JSON.stringify(oldCase.steps) !== JSON.stringify(newCase.steps)) {
         changes.push({ field: '테스트 단계(Steps)', oldVal: '이전 단계', newVal: '단계 변경됨' });
      }
      if (oldCase.type !== newCase.type) changes.push({ field: '유형(Type)', oldVal: oldCase.type, newVal: newCase.type });
      
      if (changes.length > 0) {
        HistoryService.log({
          id: generateId(),
          entityType: 'CASE',
          entityId: newCase.id,
          action: 'UPDATE',
          modifierId: modifier.id,
          modifierName: modifier.name,
          changes,
          timestamp: now()
        });
      }

      cases[existingIndex] = newCase;
      saveItems(STORAGE_KEYS.CASES, cases);
      return newCase;
    } else {
      // CREATE (생성)
      const newCase = { 
        ...caseData, 
        id: generateId(), 
        createdAt: now(), 
        updatedAt: now() 
      } as TestCase;
      
      cases.push(newCase);
      saveItems(STORAGE_KEYS.CASES, cases);
      
      HistoryService.log({
        id: generateId(),
        entityType: 'CASE',
        entityId: newCase.id,
        action: 'CREATE',
        modifierId: modifier.id,
        modifierName: modifier.name,
        changes: [],
        timestamp: now()
      });
      return newCase;
    }
  },

  // [NEW] Import 기능을 위한 대량 등록 메서드
  importCases: (projectId: string, importData: any[], user: User) => {
    const sections = getItems<Section>(STORAGE_KEYS.SECTIONS);
    const cases = getItems<TestCase>(STORAGE_KEYS.CASES);
    const history = getItems<HistoryLog>(STORAGE_KEYS.HISTORY);

    // 섹션 이름 -> ID 매핑 (기존 섹션 재사용을 위해)
    const sectionMap = new Map<string, string>(); 
    sections.filter(s => s.projectId === projectId).forEach(s => sectionMap.set(s.title, s.id));

    importData.forEach(data => {
      // 1. 섹션 확인 및 생성
      // 섹션 이름이 없으면 'Uncategorized'로 분류
      const sectionName = data.sectionTitle && data.sectionTitle.trim() !== '' ? data.sectionTitle : '미분류';
      let sectionId = sectionMap.get(sectionName);
      
      if (!sectionId) {
        const newSection = { id: generateId(), projectId, title: sectionName };
        sections.push(newSection);
        sectionMap.set(newSection.title, newSection.id);
        sectionId = newSection.id;
      }

      // 2. 케이스 생성
      const newCase: TestCase = {
        id: generateId(),
        projectId,
        sectionId,
        title: data.title,
        priority: data.priority,
        type: data.type,
        precondition: data.precondition || '',
        steps: data.steps || [],
        authorId: user.id,
        createdAt: now(),
        updatedAt: now()
      };
      cases.push(newCase);

      // 3. 이력 생성
      history.push({
        id: generateId(),
        entityType: 'CASE',
        entityId: newCase.id,
        action: 'CREATE',
        modifierId: user.id,
        modifierName: user.name,
        changes: [],
        timestamp: now()
      });
    });

    saveItems(STORAGE_KEYS.SECTIONS, sections);
    saveItems(STORAGE_KEYS.CASES, cases);
    saveItems(STORAGE_KEYS.HISTORY, history);
  }
};

export const RunService = {
  getAll: (projectId: string): TestRun[] => {
     // Ensure caseIds is always an array to prevent crashes with old data
     return getItems<TestRun>(STORAGE_KEYS.RUNS)
       .filter(r => r.projectId === projectId)
       .map(r => ({ ...r, caseIds: r.caseIds || [] }));
  },
  create: (run: Omit<TestRun, 'id' | 'createdAt'>) => {
    const runs = getItems<TestRun>(STORAGE_KEYS.RUNS);
    const newRun = { ...run, id: generateId(), createdAt: now(), caseIds: run.caseIds || [] };
    runs.push(newRun);
    saveItems(STORAGE_KEYS.RUNS, runs);
    return newRun;
  },
  getResults: (runId: string): TestResult[] => {
    return getItems<TestResult>(STORAGE_KEYS.RESULTS).filter(r => r.runId === runId);
  },
  
  // [MODIFIED] Save result with History Tracking
  saveResult: (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const results = getItems<TestResult>(STORAGE_KEYS.RESULTS);
    const runs = getItems<TestRun>(STORAGE_KEYS.RUNS);
    const users = getItems<User>(STORAGE_KEYS.USERS);
    
    // Find context info
    const runInfo = runs.find(r => r.id === result.runId);
    const tester = users.find(u => u.id === result.testerId);
    const runTitle = runInfo ? runInfo.title : 'Unknown Run';
    const testerName = tester ? tester.name : 'Unknown Tester';

    // Find previous result for Diff
    const existingIndex = results.findIndex(r => r.runId === result.runId && r.caseId === result.caseId);
    const oldResult = existingIndex > -1 ? results[existingIndex] : null;

    // Diff Calculation
    const changes: HistoryLog['changes'] = [];

    // 1. Status Change
    const oldStatus = oldResult ? oldResult.status : 'UNTESTED';
    if (oldStatus !== result.status) {
      changes.push({ field: `상태(${runTitle})`, oldVal: oldStatus, newVal: result.status });
    }

    // 2. Actual Result Change
    const oldActual = oldResult ? oldResult.actualResult : '';
    if (oldActual !== result.actualResult && (oldActual || result.actualResult)) {
      changes.push({ field: '실제결과', oldVal: oldActual, newVal: result.actualResult });
    }

    // 3. Comment Change
    const oldComment = oldResult ? oldResult.comment : '';
    if (oldComment !== result.comment && (oldComment || result.comment)) {
      changes.push({ field: '코멘트', oldVal: oldComment, newVal: result.comment });
    }

    // 4. Issue (Defect) Changes [NEW]
    const oldIssues = oldResult?.issues || [];
    const newIssues = result.issues || [];
    if (JSON.stringify(oldIssues) !== JSON.stringify(newIssues)) {
      changes.push({ 
        field: '결함(Defects)', 
        oldVal: `${oldIssues.length}개`, 
        newVal: `${newIssues.length}개` 
      });
    }

    // 5. Step Status Changes
    if (result.stepResults) {
      const oldStepsMap = new Map<string, string>();
      if (oldResult?.stepResults) {
        oldResult.stepResults.forEach(s => oldStepsMap.set(s.stepId, s.status));
      }

      result.stepResults.forEach(newStep => {
        const oldStepStatus = oldStepsMap.get(newStep.stepId);
        if (oldStepStatus && oldStepStatus !== newStep.status) {
          changes.push({ field: '단계별 상태', oldVal: oldStepStatus, newVal: newStep.status });
        }
      });
    }

    // Save Result (Upsert)
    const newResult = { ...result, id: oldResult ? oldResult.id : generateId(), timestamp: now() };
    if (existingIndex > -1) {
      results[existingIndex] = newResult;
    } else {
      results.push(newResult);
    }
    saveItems(STORAGE_KEYS.RESULTS, results);

    // Create History Log
    if (changes.length > 0) {
      HistoryService.log({
        id: generateId(),
        entityType: 'RESULT', // Log as RESULT type
        entityId: result.caseId, // Linked to CASE ID so it shows in Case History
        action: 'EXECUTE',
        modifierId: result.testerId,
        modifierName: testerName,
        changes: changes,
        timestamp: now()
      });
    }

    return newResult;
  }
};

export const HistoryService = {
  log: (log: HistoryLog) => {
    // [DB_MIGRATION]: 백엔드 트리거(Trigger)로 처리하는 것이 가장 이상적임
    const logs = getItems<HistoryLog>(STORAGE_KEYS.HISTORY);
    logs.push(log);
    saveItems(STORAGE_KEYS.HISTORY, logs);
  },
  getLogs: (entityId: string): HistoryLog[] => {
    // [DB_MIGRATION]: GET /api/cases/:id/history
    const logs = getItems<HistoryLog>(STORAGE_KEYS.HISTORY);
    return logs.filter(l => l.entityId === entityId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};