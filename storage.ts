import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, Issue, Role, ExecutionHistoryItem 
} from './types';
import { supabase } from './supabaseClient';

// Enable Supabase (Set to false for local demo stability)
const USE_SUPABASE = true; 

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

// --- LocalStorage Helpers (Wrapped in Promise for consistency) ---
const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Error parsing localStorage key "${key}":`, e);
    return [];
  }
};
const setLocal = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

// --- Services ---

export const AuthService = {
  getAllUsers: async (): Promise<User[]> => {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) { console.error(error); return []; }
      return data || [];
    } else {
      return Promise.resolve(getLocal<User>(STORAGE_KEYS.USERS));
    }
  },

  getCurrentUser: (): User | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to parse current user from localStorage. Clearing corrupted data.", e);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return null;
    }
  },

  login: async (email: string): Promise<User | null> => {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
      if (data) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data));
        return data;
      }
      // Fallback for demo if supabase is empty
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (count === 0 && email === 'admin@company.com') {
        const admin: User = { id: generateId(), name: 'Admin', email, role: 'ADMIN', status: 'ACTIVE' };
        await supabase.from('users').insert(admin);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(admin));
        return admin;
      }
      return null;
    } else {
      const users = getLocal<User>(STORAGE_KEYS.USERS);
      if (users.length === 0) {
        const seed = [
          { id: 'u1', name: '관리자(Admin)', email: 'admin@company.com', role: 'ADMIN', status: 'ACTIVE' },
          { id: 'u2', name: '김철수(QA)', email: 'jane@company.com', role: 'INTERNAL', status: 'ACTIVE' },
          { id: 'u3', name: '이영희(파트너)', email: 'ext@vendor.com', role: 'EXTERNAL', status: 'ACTIVE' },
        ] as User[];
        setLocal(STORAGE_KEYS.USERS, seed);
        const u = seed.find(u => u.email === email);
        if(u) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u));
        return u || null;
      }
      const user = users.find(u => u.email === email);
      if (user) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      return Promise.resolve(user || null);
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  updateUser: async (user: User) => {
    if (USE_SUPABASE) {
      await supabase.from('users').update(user).eq('id', user.id);
    } else {
      const users = getLocal<User>(STORAGE_KEYS.USERS);
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        users[idx] = user;
        setLocal(STORAGE_KEYS.USERS, users);
      }
    }
  },

  createUser: async (user: User) => {
    if (USE_SUPABASE) {
      await supabase.from('users').insert(user);
    } else {
      const users = getLocal<User>(STORAGE_KEYS.USERS);
      users.push(user);
      setLocal(STORAGE_KEYS.USERS, users);
    }
  }
};

export const ProjectService = {
  getAll: async (): Promise<Project[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('projects').select('*').order('createdAt', { ascending: false });
      return data || [];
    } else {
      return Promise.resolve(getLocal<Project>(STORAGE_KEYS.PROJECTS));
    }
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const newProject: Project = {
      id: generateId(),
      title: data.title!,
      description: data.description || '',
      status: data.status || 'ACTIVE',
      createdAt: now()
    };
    if (USE_SUPABASE) {
      await supabase.from('projects').insert(newProject);
    } else {
      const list = getLocal<Project>(STORAGE_KEYS.PROJECTS);
      list.unshift(newProject);
      setLocal(STORAGE_KEYS.PROJECTS, list);
    }
    return newProject;
  }
};

export const TestCaseService = {
  getSections: async (projectId: string): Promise<Section[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('sections').select('*').eq('projectId', projectId);
      return data || [];
    } else {
      return Promise.resolve(getLocal<Section>(STORAGE_KEYS.SECTIONS).filter(s => s.projectId === projectId));
    }
  },

  createSection: async (data: Partial<Section>) => {
    const newSec: Section = {
      id: generateId(),
      projectId: data.projectId!,
      title: data.title!,
      parentId: data.parentId || null
    };
    if (USE_SUPABASE) {
      await supabase.from('sections').insert(newSec);
    } else {
      const list = getLocal<Section>(STORAGE_KEYS.SECTIONS);
      list.push(newSec);
      setLocal(STORAGE_KEYS.SECTIONS, list);
    }
    return newSec;
  },

  deleteSection: async (sectionId: string): Promise<void> => {
    if (USE_SUPABASE) {
      // Supabase cascade delete not implemented in this demo
      await supabase.from('testCases').delete().eq('sectionId', sectionId);
      await supabase.from('sections').delete().eq('id', sectionId);
    } else {
      // 1. Delete all cases in this section
      let cases = getLocal<TestCase>(STORAGE_KEYS.CASES);
      cases = cases.filter(c => c.sectionId !== sectionId);
      setLocal(STORAGE_KEYS.CASES, cases);

      // 2. Delete the section itself
      let sections = getLocal<Section>(STORAGE_KEYS.SECTIONS);
      sections = sections.filter(s => s.id !== sectionId);
      setLocal(STORAGE_KEYS.SECTIONS, sections);
      
      return Promise.resolve();
    }
  },

  getCases: async (projectId: string): Promise<TestCase[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('testCases').select('*').eq('projectId', projectId);
      return data || [];
    } else {
      return Promise.resolve(getLocal<TestCase>(STORAGE_KEYS.CASES).filter(c => c.projectId === projectId));
    }
  },

  saveCase: async (data: Partial<TestCase>, user: User): Promise<TestCase> => {
    if (USE_SUPABASE) {
      if (data.id) {
        // Update
        const { data: oldData } = await supabase.from('testCases').select('*').eq('id', data.id).single();
        if (oldData) {
          await HistoryService.logChange(oldData, data as TestCase, user);
        }
        const payload = { ...data, updatedAt: now() };
        const { data: saved } = await supabase.from('testCases').update(payload).eq('id', data.id).select().single();
        return saved as TestCase;
      } else {
        // Create
        const newCase: TestCase = {
          id: generateId(),
          projectId: data.projectId!,
          sectionId: data.sectionId!,
          title: data.title!,
          precondition: data.precondition || '',
          steps: data.steps || [],
          priority: data.priority || 'MEDIUM',
          type: data.type || 'FUNCTIONAL',
          authorId: user.id,
          createdAt: now(),
          updatedAt: now()
        };
        await supabase.from('testCases').insert(newCase);
        await HistoryService.logChange(null, newCase, user);
        return newCase;
      }
    } else {
      const list = getLocal<TestCase>(STORAGE_KEYS.CASES);
      if (data.id) {
        const idx = list.findIndex(c => c.id === data.id);
        if (idx !== -1) {
          const old = list[idx];
          const updated = { ...old, ...data, updatedAt: now() } as TestCase;
          await HistoryService.logChange(old, updated, user);
          list[idx] = updated;
          setLocal(STORAGE_KEYS.CASES, list);
          return updated;
        }
      }
      const newCase: TestCase = {
        id: generateId(),
        projectId: data.projectId!,
        sectionId: data.sectionId!,
        title: data.title!,
        precondition: data.precondition || '',
        steps: data.steps || [],
        priority: data.priority || 'MEDIUM',
        type: data.type || 'FUNCTIONAL',
        authorId: user.id,
        createdAt: now(),
        updatedAt: now()
      };
      await HistoryService.logChange(null, newCase, user);
      list.push(newCase);
      setLocal(STORAGE_KEYS.CASES, list);
      return Promise.resolve(newCase);
    }
    throw new Error("Save failed");
  },

  deleteCase: async (caseId: string): Promise<void> => {
    if (USE_SUPABASE) {
      await supabase.from('testCases').delete().eq('id', caseId);
    } else {
      let list = getLocal<TestCase>(STORAGE_KEYS.CASES);
      list = list.filter(c => c.id !== caseId);
      setLocal(STORAGE_KEYS.CASES, list);
      return Promise.resolve();
    }
  },

  importCases: async (projectId: string, cases: Partial<TestCase>[], user: User) => {
    const uniqueSections = Array.from(new Set(cases.map(c => c.sectionTitle || 'Uncategorized')));
    const existingSections = await TestCaseService.getSections(projectId);
    
    const sectionMap = new Map<string, string>(); 
    
    for (const secTitle of uniqueSections) {
      let match = existingSections.find(s => s.title === secTitle);
      if (!match) {
        match = await TestCaseService.createSection({ projectId, title: secTitle as string });
      }
      if (match) sectionMap.set(secTitle as string, match.id);
    }

    const newCases: TestCase[] = cases.map(c => ({
      id: generateId(),
      projectId,
      sectionId: sectionMap.get(c.sectionTitle || 'Uncategorized')!,
      title: c.title!,
      precondition: c.precondition || '',
      steps: c.steps || [],
      priority: c.priority || 'MEDIUM',
      type: c.type || 'FUNCTIONAL',
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
};

export const RunService = {
  getAll: async (projectId: string): Promise<TestRun[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('testRuns').select('*').eq('projectId', projectId).order('createdAt', { ascending: false });
      return data || [];
    } else {
      return Promise.resolve(getLocal<TestRun>(STORAGE_KEYS.RUNS).filter(r => r.projectId === projectId));
    }
  },

  create: async (data: Partial<TestRun>): Promise<TestRun> => {
    const newRun: TestRun = {
      id: generateId(),
      projectId: data.projectId!,
      title: data.title!,
      status: 'OPEN',
      assignedToId: data.assignedToId,
      caseIds: data.caseIds || [],
      createdAt: now()
    };
    if (USE_SUPABASE) {
      await supabase.from('testRuns').insert(newRun);
    } else {
      const list = getLocal<TestRun>(STORAGE_KEYS.RUNS);
      list.unshift(newRun);
      setLocal(STORAGE_KEYS.RUNS, list);
    }
    return newRun;
  },

  getResults: async (runId: string): Promise<TestResult[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('testResults').select('*').eq('runId', runId);
      return data || [];
    } else {
      return Promise.resolve(getLocal<TestResult>(STORAGE_KEYS.RESULTS).filter(r => r.runId === runId));
    }
  },

  saveResult: async (data: Partial<TestResult>) => {
    if (USE_SUPABASE) {
    // Supabase implementation simplified for this example
    // ▼ 수정: maybeSingle()은 데이터가 없으면 에러 대신 null을 반환함 (406 에러 해결)
    const { data: existing } = await supabase.from('testResults').select('*').eq('runId', data.runId).eq('caseId', data.caseId).maybeSingle();
    
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
        status: data.status,
        actualResult: data.actualResult,
        comment: data.comment,
        testerId: data.testerId,
        stepResults: data.stepResults,
        issues: data.issues,
        timestamp: now(),
        history
      };

      if (existing) {
        await supabase.from('testResults').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('testResults').insert({
          id: generateId(),
          runId: data.runId,
          caseId: data.caseId,
          ...payload
        });
      }
    } else {
      const list = getLocal<TestResult>(STORAGE_KEYS.RESULTS);
      const idx = list.findIndex(r => r.runId === data.runId && r.caseId === data.caseId);
      
      let history: ExecutionHistoryItem[] = [];
      if (idx !== -1) {
        const existing = list[idx];
        history = existing.history || [];
        // Only push to history if status has changed or actual result is modified to avoid spam
        if (existing.status !== 'UNTESTED') {
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
      }

      const payload = {
        runId: data.runId!,
        caseId: data.caseId!,
        status: data.status!,
        actualResult: data.actualResult || '',
        comment: data.comment || '',
        testerId: data.testerId!,
        stepResults: data.stepResults || [],
        issues: data.issues || [],
        timestamp: now(),
        history
      };

      if (idx !== -1) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push({ id: generateId(), ...payload });
      }
      setLocal(STORAGE_KEYS.RESULTS, list);
      return Promise.resolve();
    }
  }
};

export const HistoryService = {
  getLogs: async (entityId: string): Promise<HistoryLog[]> => {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('historyLogs').select('*').eq('entityId', entityId).order('timestamp', { ascending: false });
      return data || [];
    } else {
      return Promise.resolve(getLocal<HistoryLog>(STORAGE_KEYS.HISTORY)
        .filter(h => h.entityId === entityId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }
  },

  logChange: async (oldObj: any, newObj: any, user: User) => {
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
      list.push(log);
      setLocal(STORAGE_KEYS.HISTORY, list);
    }
  }
};