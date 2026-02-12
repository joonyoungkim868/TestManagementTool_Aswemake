import {
    User, Project, ProjectStatus, Section, TestCase, TestRun, TestResult,
    HistoryLog, TestStatus, TestStep, ExecutionHistoryItem
} from './types';

// Mock Data Storage (Local Storage Simulation)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const STORAGE_KEYS = {
    USERS: 'tm_users',
    PROJECTS: 'tm_projects',
    SECTIONS: 'tm_sections',
    CASES: 'tm_cases',
    RUNS: 'tm_runs',
    RESULTS: 'tm_results',
    HISTORY: 'tm_history' // 변경 이력
};

const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = (key: string, data: any[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// --- Services ---

export class AuthService {
    static async login(email: string): Promise<User | null> {
        await delay(500);
        const users = getStorage<User>(STORAGE_KEYS.USERS);
        let user = users.find(u => u.email === email);

        // Auto-register convenience for demo
        if (!user) {
            user = {
                id: Date.now().toString(),
                email,
                name: email.split('@')[0],
                role: email.includes('admin') ? 'ADMIN' : 'USER'
            };
            users.push(user);
            setStorage(STORAGE_KEYS.USERS, users);
        }
        return user;
    }

    static async getAllUsers(): Promise<User[]> {
        return getStorage<User>(STORAGE_KEYS.USERS);
    }
}

export class HistoryService {
    static async log(
        targetId: string,
        modifier: User,
        action: 'CREATE' | 'UPDATE' | 'DELETE',
        changes: { field: string, oldVal: any, newVal: any }[]
    ) {
        const logs = getStorage<HistoryLog>(STORAGE_KEYS.HISTORY);
        const newLog: HistoryLog = {
            id: Date.now().toString() + Math.random().toString().slice(2, 5),
            targetId,
            modifierId: modifier.id,
            modifierName: modifier.name,
            action,
            changes,
            timestamp: new Date().toISOString(),
            version: logs.filter(l => l.targetId === targetId).length + 1
        };
        setStorage(STORAGE_KEYS.HISTORY, [newLog, ...logs]);
    }

    static async getLogs(targetId: string): Promise<HistoryLog[]> {
        const logs = getStorage<HistoryLog>(STORAGE_KEYS.HISTORY);
        return logs.filter(l => l.targetId === targetId);
    }
}

export class ProjectService {
    static async getAll(): Promise<Project[]> {
        await delay(300);
        return getStorage<Project>(STORAGE_KEYS.PROJECTS);
    }

    static async get(id: string): Promise<Project | undefined> {
        await delay(200);
        const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS);
        return projects.find(p => p.id === id);
    }

    static async create(title: string, desc: string): Promise<Project> {
        await delay(300);
        const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS);
        const newProject: Project = {
            id: Date.now().toString(),
            title,
            description: desc,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        projects.push(newProject);
        setStorage(STORAGE_KEYS.PROJECTS, projects);
        return newProject;
    }

    static async update(id: string, updates: Partial<Project>): Promise<Project> {
        await delay(300);
        const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS);
        const idx = projects.findIndex(p => p.id === id);
        if (idx !== -1) {
            projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
            setStorage(STORAGE_KEYS.PROJECTS, projects);
            return projects[idx];
        }
        throw new Error("Project not found");
    }

    static async delete(id: string): Promise<void> {
        await delay(300);
        const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS);
        setStorage(STORAGE_KEYS.PROJECTS, projects.filter(p => p.id !== id));
    }
}

export class TestCaseService {
    static async getSections(projectId: string): Promise<Section[]> {
        await delay(200);
        const sections = getStorage<Section>(STORAGE_KEYS.SECTIONS);
        return sections.filter(s => s.projectId === projectId);
    }

    static async createSection(data: Partial<Section>): Promise<Section> {
        const sections = getStorage<Section>(STORAGE_KEYS.SECTIONS);
        const newSection = { id: Date.now().toString(), ...data } as Section;
        setStorage(STORAGE_KEYS.SECTIONS, [...sections, newSection]);
        return newSection;
    }

    static async deleteSection(sectionId: string): Promise<void> {
        const sections = getStorage<Section>(STORAGE_KEYS.SECTIONS);
        setStorage(STORAGE_KEYS.SECTIONS, sections.filter(s => s.id !== sectionId));

        // Cascade delete cases? (In real app yes, here let's keep orphans or delete them)
        // Let's delete orphans for cleanliness
        const cases = getStorage<TestCase>(STORAGE_KEYS.CASES);
        setStorage(STORAGE_KEYS.CASES, cases.filter(c => c.sectionId !== sectionId));
    }

    static async getCases(projectId: string): Promise<TestCase[]> {
        await delay(300);
        const cases = getStorage<TestCase>(STORAGE_KEYS.CASES);
        return cases.filter(c => c.projectId === projectId);
    }

    static async saveCase(data: Partial<TestCase>, user: User): Promise<TestCase> {
        await delay(300);
        const cases = getStorage<TestCase>(STORAGE_KEYS.CASES);
        const idx = cases.findIndex(c => c.id === data.id);

        if (idx !== -1) {
            // Update
            const oldCase = cases[idx];
            const changes: any[] = [];

            // Calculate Diff
            Object.keys(data).forEach(key => {
                const k = key as keyof TestCase;
                if (JSON.stringify(oldCase[k]) !== JSON.stringify(data[k]) && k !== 'updatedAt') {
                    changes.push({ field: k, oldVal: oldCase[k], newVal: data[k] });
                }
            });

            if (changes.length > 0) {
                await HistoryService.log(oldCase.id, user, 'UPDATE', changes);
                cases[idx] = { ...oldCase, ...data, updatedAt: new Date().toISOString() } as TestCase;
                setStorage(STORAGE_KEYS.CASES, cases);
            }
            return cases[idx];
        } else {
            // Create
            const newCase: TestCase = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                authorId: user.id,
                ...data
            } as TestCase;

            setStorage(STORAGE_KEYS.CASES, [...cases, newCase]);
            await HistoryService.log(newCase.id, user, 'CREATE', []);
            return newCase;
        }
    }

    static async deleteCase(id: string): Promise<void> {
        const cases = getStorage<TestCase>(STORAGE_KEYS.CASES);
        setStorage(STORAGE_KEYS.CASES, cases.filter(c => c.id !== id));
    }

    static async importCases(projectId: string, newCases: any[], user: User): Promise<void> {
        const cases = getStorage<TestCase>(STORAGE_KEYS.CASES);
        const sections = getStorage<Section>(STORAGE_KEYS.SECTIONS);

        // 1. Ensure Sections Exist
        const sectionMap = new Map(sections.filter(s => s.projectId === projectId).map(s => [s.title, s.id]));

        const createdCases: TestCase[] = [];

        for (const nc of newCases) {
            let secId = nc.sectionTitle ? sectionMap.get(nc.sectionTitle) : null;
            if (nc.sectionTitle && !secId) {
                const newSec = await this.createSection({ projectId, title: nc.sectionTitle });
                secId = newSec.id;
                sectionMap.set(nc.sectionTitle, secId);
                sections.push(newSec); // update local ref
            }

            const newCase: TestCase = {
                id: Math.random().toString(36).substr(2, 9),
                projectId,
                sectionId: secId || sections.find(s => s.projectId === projectId)?.id || 'root',
                title: nc.title,
                priority: nc.priority || 'MEDIUM',
                type: nc.type || 'FUNCTIONAL',
                precondition: nc.precondition || '',
                steps: nc.steps || [],
                authorId: user.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            createdCases.push(newCase);
        }

        setStorage(STORAGE_KEYS.CASES, [...cases, ...createdCases]);
    }
}

export class RunService {
    static async getAll(projectId: string): Promise<TestRun[]> {
        await delay(300);
        const runs = getStorage<TestRun>(STORAGE_KEYS.RUNS);
        return runs.filter(r => r.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    static async create(data: Partial<TestRun>): Promise<TestRun> {
        const runs = getStorage<TestRun>(STORAGE_KEYS.RUNS);
        const newRun = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...data
        } as TestRun;
        setStorage(STORAGE_KEYS.RUNS, [newRun, ...runs]); // 최신순
        return newRun;
    }

    static async delete(id: string): Promise<void> {
        const runs = getStorage<TestRun>(STORAGE_KEYS.RUNS);
        setStorage(STORAGE_KEYS.RUNS, runs.filter(r => r.id !== id));

        // Clean up results
        const results = getStorage<TestResult>(STORAGE_KEYS.RESULTS);
        setStorage(STORAGE_KEYS.RESULTS, results.filter(r => r.runId !== id));
    }

    static async getResults(runId: string): Promise<TestResult[]> {
        const results = getStorage<TestResult>(STORAGE_KEYS.RESULTS);
        return results.filter(r => r.runId === runId);
    }

    static async saveResult(data: Partial<TestResult>): Promise<void> {
        const results = getStorage<TestResult>(STORAGE_KEYS.RESULTS);
        const idx = results.findIndex(r => r.runId === data.runId && r.caseId === data.caseId);

        if (idx !== -1) {
            // Update logic implies keeping history in most robust systems
            // Here we append to history field
            const prev = results[idx];
            const historyItem: ExecutionHistoryItem = {
                status: prev.status,
                actualResult: prev.actualResult,
                comment: prev.comment,
                testerId: prev.testerId,
                timestamp: prev.updatedAt,
                issues: prev.issues || [],
                stepResults: prev.stepResults
            };

            results[idx] = {
                ...prev,
                ...data,
                history: [...(prev.history || []), historyItem],
                updatedAt: new Date().toISOString()
            } as TestResult;
        } else {
            results.push({
                id: Date.now().toString(),
                updatedAt: new Date().toISOString(),
                history: [],
                ...data
            } as TestResult);
        }
        setStorage(STORAGE_KEYS.RESULTS, results);
    }
}

export class DashboardService {
    static async getStats(projectId: string) {
        const runs = await RunService.getAll(projectId);
        const cases = await TestCaseService.getCases(projectId);

        // Calculate 7-day trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentRuns = runs.filter(r => new Date(r.createdAt) >= sevenDaysAgo).reverse();
        const chartData = [];

        let totalPass = 0;
        let totalRuns = 0;
        let defectCount = 0;

        for (const run of recentRuns) {
            const results = await RunService.getResults(run.id);
            const pass = results.filter(r => r.status === 'PASS').length;
            const fail = results.filter(r => r.status === 'FAIL').length;
            const block = results.filter(r => r.status === 'BLOCK').length;

            chartData.push({
                name: run.title.length > 10 ? run.title.substr(0, 10) + '...' : run.title,
                passed: pass,
                failed: fail,
                blocked: block
            });

            if (results.length > 0) {
                totalPass += (pass / results.length);
                totalRuns++;
            }

            // Defects
            results.forEach(r => {
                if (r.issues) defectCount += r.issues.length;
            });
        }

        const passRate = totalRuns > 0 ? Math.round((totalPass / totalRuns) * 100) : 0;

        return {
            totalCases: cases.length,
            activeRuns: runs.length, // Simple metric
            passRate,
            defectCount,
            chartData
        };
    }
}
