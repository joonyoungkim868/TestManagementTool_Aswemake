import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, Issue, ExecutionHistoryItem, TestStatus 
} from './types';
import { supabase } from '../supabaseClient';

// Supabase 사용 설정
const USE_SUPABASE = true; 

const STORAGE_KEYS = {
  USERS: 'tm_users',
  PROJECTS: 'tm_projects',
  SECTIONS: 'tm_sections',
  CASES: 'tm_cases',
  RUNS: 'tm_runs',
  RESULTS: 'tm_results',
  HISTORY: 'tm_history',
  CURRENT_USER: 'tm_current_user_email',
};

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// --- LocalStorage Helpers (Fallback) ---
const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};
const setLocal = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

// --- Services ---

export class AuthService {
  static async getAllUsers(): Promise<User[]> {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) { console.error(error); return []; }
      return data || [];
    }
    return getLocal<User>(STORAGE_KEYS.USERS);
  }

  static getCurrentUser(): User | null {
    return null; // App.tsx에서 로드 및 관리
  }

  static async login(email: string): Promise<User | null> {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (data) return data;
      
      // 데모용: 계정이 없으면 자동 생성 (Admin 등)
      if (email === 'admin@company.com') {
        const admin: User = { 
          id: generateId(), 
          name: 'Admin', 
          email, 
          role: 'ADMIN', 
          status: 'ACTIVE' 
        };
        await supabase.from('users').insert(admin);
        return admin;
      }
      return null;
    } else {
      // LocalStorage Mock Logic
      const users = getLocal<User>(STORAGE_KEYS.USERS);
      let user = users.find(u => u.email === email);
      if (!user) {
         user = { 
           id: generateId(), 
           email, 
           name: email.split('@')[0], 
           role: email.includes('admin') ? 'ADMIN' : 'USER', 
           status: 'ACTIVE' 
         } as User;
         users.push(user);
         setLocal(STORAGE_KEYS.USERS, users);
      }
      return user;
    }
  }

  static logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export class ProjectService {
  static async getAll(): Promise<Project[]> {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('projects').select('*').order('createdAt', { ascending: false });
      return data || [];
    }
    return getLocal<Project>(STORAGE_KEYS.PROJECTS);
  }

  static async create(title: string, description: string, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE'): Promise<Project> {
    const newProject: Project = {
      id: generateId(),
      title,
      description,
      status,
      createdAt: now()
    } as Project;

    if (USE_SUPABASE) {
      await supabase.from('projects').insert(newProject);
    } else {
      const list = getLocal<Project>(STORAGE_KEYS.PROJECTS);
      list.unshift(newProject);
      setLocal(STORAGE_KEYS.PROJECTS, list);
    }
    return newProject;
  }

  static async update(project: Project): Promise<void> {
    if (USE_SUPABASE) {
      await supabase.from('projects').update({
        title: project.title,
        description: project.description,
        status: project.status
      }).eq('id', project.id);
    } else {
      const list = getLocal<Project>(STORAGE_KEYS.PROJECTS);
      const idx = list.findIndex(p => p.id === project.id);
      if (idx !== -1) {
        list[idx] = project;
        setLocal(STORAGE_KEYS.PROJECTS, list);
      }
    }
  }

  static async delete(projectId: string): Promise<void> {
    if (USE_SUPABASE) {
      // Cascade Delete Logic
      const { data: runs } = await supabase.from('testRuns').select('id').eq('projectId', projectId);
      const runIds = runs?.map(r => r.id) || [];
      
      if (runIds.length > 0) {
        await supabase.from('testResults').delete().in('runId', runIds);
      }
      await supabase.from('testRuns').delete().eq('projectId', projectId);
      
      // History 로그 삭제 (선택 사항 - 데이터 정리용)
      const { data: cases } = await supabase.from('testCases').select('id').eq('projectId', projectId);
      const caseIds = cases?.map(c => c.id) || [];
      if (caseIds.length > 0) {
        await supabase.from('historyLogs').delete().in('entityId', caseIds);
      }

      await supabase.from('testCases').delete().eq('projectId', projectId);
      await supabase.from('sections').delete().eq('projectId', projectId);
      await supabase.from('projects').delete().eq('id', projectId);
    } else {
      let projects = getLocal<Project>(STORAGE_KEYS.PROJECTS).filter(p => p.id !== projectId);
      setLocal(STORAGE_KEYS.PROJECTS, projects);
    }
  }
}

export class TestCaseService {
  static async getSections(projectId: string): Promise<Section[]> {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('sections').select('*').eq('projectId', projectId);
      return data || [];
    }
    return getLocal<Section>(STORAGE_KEYS.SECTIONS).filter(s => s.projectId === projectId);
  }

  static async createSection(data: Partial<Section>) {
    const newSec = { 
      id: generateId(), 
      projectId: data.projectId!, 
      title: data.title!, 
      parentId: null 
    } as Section;

    if (USE_SUPABASE) {
      await supabase.from('sections').insert(newSec);
    } else {
      const list = getLocal<Section>(STORAGE_KEYS.SECTIONS);
      list.push(newSec);
      setLocal(STORAGE_KEYS.SECTIONS, list);
    }
    return newSec;
  }

  static async deleteSection(sectionId: string): Promise<void> {
    if (USE_SUPABASE) {
      await supabase.from('testCases').delete().eq('sectionId', sectionId);
      await supabase.from('sections').delete().eq('id', sectionId);
    } else {
      let cases = getLocal<TestCase>(STORAGE_KEYS.CASES).filter(c => c.sectionId !== sectionId);
      setLocal(STORAGE_KEYS.CASES, cases);
      
      let sections = getLocal<Section>(STORAGE_KEYS.SECTIONS).filter(s => s.id !== sectionId);
      setLocal(STORAGE_KEYS.SECTIONS, sections);
    }
  }

    static async getCases(projectId: string): Promise<TestCase[]> {
        if (USE_SUPABASE) {
        const { data } = await supabase
            .from('testCases')
            .select('*')
            .eq('projectId', projectId)
            .order('seq_id', { ascending: true });
        return data || [];
        }
    return getLocal<TestCase>(STORAGE_KEYS.CASES).filter(c => c.projectId === projectId);
  }

static async saveCase(data: Partial<TestCase>, user: User): Promise<TestCase> {
    const payload = { ...data, updatedAt: now() };
    
    if (!payload.id) {
       // [Create] 새로운 케이스 생성
       payload.id = generateId();
       payload.createdAt = now();
       payload.authorId = user.id;
       
       // ✅ 명시적 객체 생성 (note 포함)
       const newCase: TestCase = {
          id: payload.id,
          projectId: data.projectId!,
          sectionId: data.sectionId!,
          title: data.title!,
          precondition: data.precondition || '',
          steps: data.steps || [],
          priority: data.priority || 'MEDIUM',
          type: data.type || 'FUNCTIONAL',
          note: data.note || '',
          platform_type: data.platform_type || 'WEB', // 기본값 WEB
          authorId: user.id,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt,
          seq_id: data.seq_id // (Optional) 이미 있다면 유지
       };

       if(USE_SUPABASE) {
          await supabase.from('testCases').insert(newCase);
          await HistoryService.logChange(null, newCase, user);
       } else {
          const list = getLocal<TestCase>(STORAGE_KEYS.CASES);
          list.push(newCase);
          setLocal(STORAGE_KEYS.CASES, list);
          HistoryService.logChange(null, newCase, user);
       }
       return newCase;
    } else {
       // [Update] 기존 케이스 수정
       if(USE_SUPABASE) {
          const { data: oldData } = await supabase.from('testCases').select('*').eq('id', payload.id).single();
          await HistoryService.logChange(oldData, payload, user);
          await supabase.from('testCases').update(payload).eq('id', payload.id);
       } else {
          const list = getLocal<TestCase>(STORAGE_KEYS.CASES);
          const idx = list.findIndex(c => c.id === payload.id);
          if (idx !== -1) {
            const oldData = list[idx];
            HistoryService.logChange(oldData, payload, user);
            list[idx] = { ...oldData, ...payload } as TestCase;
            setLocal(STORAGE_KEYS.CASES, list);
          }
       }
       return payload as TestCase;
    }
}

  static async deleteCase(caseId: string): Promise<void> {
    if (USE_SUPABASE) {
      await supabase.from('testCases').delete().eq('id', caseId);
    } else {
      const list = getLocal<TestCase>(STORAGE_KEYS.CASES).filter(c => c.id !== caseId);
      setLocal(STORAGE_KEYS.CASES, list);
    }
  }

  static async importCases(projectId: string, cases: Partial<TestCase>[], user: User) {
    // 1. 기존 섹션 조회
    const existingSections = await TestCaseService.getSections(projectId);
    const sectionMap = new Map<string, string>(); 
    
    // 2. 섹션 매핑 및 생성
    const uniqueSections = Array.from(new Set(cases.map(c => c.sectionTitle || 'Uncategorized')));
    
    for (const secTitle of uniqueSections) {
      let match = existingSections.find(s => s.title === secTitle);
      if (!match) {
        const newSec = await TestCaseService.createSection({ projectId, title: secTitle as string }); 
        match = newSec;
      }
      if (match) sectionMap.set(secTitle as string, match.id);
    }

    // 3. 케이스 변환
    const newCases: TestCase[] = cases.map(c => ({
      id: generateId(),
      projectId,
      sectionId: sectionMap.get(c.sectionTitle || 'Uncategorized')!,
      title: c.title!,
      precondition: c.precondition || '',
      steps: c.steps || [],
      priority: c.priority || 'MEDIUM',
      type: c.type || 'FUNCTIONAL',
      note: c.note || '',
      platform_type: c.platform_type || 'WEB', // 기본값 WEB
      authorId: user.id,
      createdAt: now(),
      updatedAt: now()
    }));

    if (USE_SUPABASE) {
      if (newCases.length > 0) {
        await supabase.from('testCases').insert(newCases);
      }
    } else {
      const list = getLocal<TestCase>(STORAGE_KEYS.CASES);
      list.push(...newCases);
      setLocal(STORAGE_KEYS.CASES, list);
    }
  }
}

export class RunService {
  static async getAll(projectId: string): Promise<TestRun[]> {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('testRuns').select('*').eq('projectId', projectId).order('createdAt', { ascending: false });
      return data || [];
    }
    return getLocal<TestRun>(STORAGE_KEYS.RUNS).filter(r => r.projectId === projectId);
  }

  static async create(data: Partial<TestRun>): Promise<TestRun> {
    const newRun = { 
      id: generateId(), 
      ...data, 
      status: 'OPEN', 
      createdAt: now() 
    } as TestRun;

    if (USE_SUPABASE) {
      await supabase.from('testRuns').insert(newRun);
    } else {
      const list = getLocal<TestRun>(STORAGE_KEYS.RUNS);
      list.unshift(newRun);
      setLocal(STORAGE_KEYS.RUNS, list);
    }
    return newRun;
  }

  static async delete(runId: string): Promise<void> {
    if (USE_SUPABASE) {
      await supabase.from('testResults').delete().eq('runId', runId);
      await supabase.from('testRuns').delete().eq('id', runId);
    } else {
      let runs = getLocal<TestRun>(STORAGE_KEYS.RUNS).filter(r => r.id !== runId);
      setLocal(STORAGE_KEYS.RUNS, runs);
    }
  }

  static async getResults(runId: string): Promise<TestResult[]> {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('testResults').select('*').eq('runId', runId);
      return data || [];
    }
    return getLocal<TestResult>(STORAGE_KEYS.RESULTS).filter(r => r.runId === runId);
  }

  static async saveResult(data: Partial<TestResult>) {
    if (USE_SUPABASE) {
        const targetDevice = data.device_platform || 'PC';
        
        let existing = null;

        // 1. [기존 버그 해결] 프론트엔드에 id가 있다면 무조건 id로 조회
        if (data.id && data.id !== 'temp') {
            const { data: res } = await supabase.from('testResults').select('*').eq('id', data.id).maybeSingle();
            existing = res;
        } else {
            // 신규일 경우 복합키로 조회
            const { data: res } = await supabase
                .from('testResults')
                .select('*')
                .eq('runId', data.runId)
                .eq('caseId', data.caseId)
                .eq('device_platform', targetDevice)
                .maybeSingle();
            existing = res;
        }
        
        let history: ExecutionHistoryItem[] = existing?.history || [];
        if (existing && existing.status !== 'UNTESTED') {
            history.unshift({
              status: existing.status,
              actualResult: existing.actualResult,
              comment: existing.comment,
              testerId: existing.testerId,
              timestamp: existing.timestamp,
              issues: existing.issues,
              stepResults: existing.stepResults
            });
        }

        const payload = { 
          runId: data.runId,
          caseId: data.caseId,
          status: data.status,
          actualResult: data.actualResult,
          comment: data.comment,
          testerId: data.testerId,
          stepResults: data.stepResults,
          issues: data.issues,
          device_platform: targetDevice,
          history, 
          timestamp: now() 
        };
        
        if (existing) {
          // 기존 데이터 UPDATE
          await supabase.from('testResults').update(payload).eq('id', existing.id);
        } else {
          // 2. 신규 생성 (UNTESTED 상태에서 첫 클릭 시)
          const newId = (data.id && data.id !== 'temp') ? data.id : generateId();
          const { error } = await supabase.from('testResults').insert({ id: newId, ...payload });
          
          // 3. [동시성 409 에러 해결]
          // 빠르게 여러 Step을 눌러서 다른 요청이 이미 INSERT를 선점했다면 (23505 에러 또는 409 발생)
          // 실패시키지 않고, 선점된 Row의 ID를 찾아내서 조용히 UPDATE로 재시도합니다.
          if (error && (error.code === '23505' || error.message?.includes('duplicate'))) {
             console.warn("Concurrent insert detected. Retrying as update...");
             const { data: retryExisting } = await supabase
                .from('testResults')
                .select('id')
                .eq('runId', data.runId)
                .eq('caseId', data.caseId)
                .eq('device_platform', targetDevice)
                .maybeSingle();
                
             if (retryExisting) {
                 await supabase.from('testResults').update(payload).eq('id', retryExisting.id);
             }
          } else if (error) {
             console.error("Save result failed:", error);
          }
        }
    } else {
        // LocalStorage Fallback logic
    }
  }
}

export class HistoryService {
  static async getLogs(entityId: string): Promise<HistoryLog[]> {
    if (USE_SUPABASE) {
        const { data } = await supabase.from('historyLogs').select('*').eq('entityId', entityId).order('timestamp', { ascending: false });
        return data || [];
    }
    return getLocal<HistoryLog>(STORAGE_KEYS.HISTORY).filter(h => h.entityId === entityId);
  }

  static async logChange(oldObj: any, newObj: any, user: User) {
    const changes: any[] = [];
    if (!oldObj) {
      changes.push({ field: 'ALL', oldVal: null, newVal: 'CREATED' });
    } else {
      for (const key of Object.keys(newObj)) {
        if (key === 'updatedAt' || key === 'createdAt' || key === 'history') continue;
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          changes.push({ field: key, oldVal: oldObj[key], newVal: newObj[key] });
        }
      }
    }

    if (changes.length === 0) return;

    const log: HistoryLog = {
      id: generateId(),
      entityType: 'CASE',
      entityId: newObj.id,
      action: oldObj ? 'UPDATE' : 'CREATE',
      modifierId: user.id,
      modifierName: user.name,
      changes,
      timestamp: now()
    };

    if (USE_SUPABASE) {
      await supabase.from('historyLogs').insert(log);
    } else {
      const list = getLocal<HistoryLog>(STORAGE_KEYS.HISTORY);
      list.unshift(log);
      setLocal(STORAGE_KEYS.HISTORY, list);
    }
  }
}

export class DashboardService {
  static async getStats(projectId: string) {
    let totalCases = 0;
    let activeRuns = 0;
    let passRate = 0;
    let defectCount = 0;
    let chartData: { name: string, passed: number, failed: number }[] = [];

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (USE_SUPABASE) {
      // 1. 총 테스트 케이스 수
      const { count } = await supabase
        .from('testCases')
        .select('*', { count: 'exact', head: true })
        .eq('projectId', projectId);
      totalCases = count || 0;

      // 2. 진행 중인 테스트 실행 (Active Runs)
      const { data: runs } = await supabase
        .from('testRuns')
        .select('id, status')
        .eq('projectId', projectId);
      
      const runList = runs || [];
      activeRuns = runList.filter(r => r.status === 'OPEN').length;

      // 3. 결과 집계 (Pass Rate, Defects, Chart)
      const runIds = runList.map(r => r.id);
      let allResults: TestResult[] = [];

      if (runIds.length > 0) {
        const { data: results } = await supabase
          .from('testResults')
          .select('*')
          .in('runId', runIds);
        allResults = results || [];
      }

      const passedCount = allResults.filter(r => r.status === 'PASS').length;
      const totalTested = allResults.length;
      passRate = totalTested > 0 ? Math.round((passedCount / totalTested) * 100) : 0;

      defectCount = allResults.reduce((sum, r) => sum + (r.issues?.length || 0), 0);

      // 차트 데이터 (최근 7일)
      const days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return formatDate(d);
      });

      chartData = days.map(day => {
        const daily = allResults.filter(r => r.timestamp && r.timestamp.startsWith(day));
        return {
          name: day.slice(5),
          passed: daily.filter(r => r.status === 'PASS').length,
          failed: daily.filter(r => r.status === 'FAIL').length
        };
      });

    } else {
      // LocalStorage Fallback (Mock)
      return { totalCases: 0, activeRuns: 0, passRate: 0, defectCount: 0, chartData: [] };
    }

    return { totalCases, activeRuns, passRate, defectCount, chartData };
  }
}