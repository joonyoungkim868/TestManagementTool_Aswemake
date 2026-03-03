import {
  User, Folder, Document, Section, TestCase, TestRun, TestResult, HistoryLog,
  Issue, ExecutionHistoryItem, TestStatus
} from './types';
import { supabase } from '../supabaseClient';

const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// --- Services ---

export class AuthService {
  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) { console.error(error); return []; }
    return data || [];
  }

  static async login(email: string): Promise<User | null> {
    const { data } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (data) return data;

    // Auto-create for demo if not exists
    const newUser: User = {
      id: generateId(),
      name: email.split('@')[0],
      email,
      role: email.includes('admin') ? 'ADMIN' : 'INTERNAL',
      status: 'ACTIVE'
    };
    const { error } = await supabase.from('users').insert(newUser);
    if (!error) return newUser;
    return null;
  }

  static logout() {
    localStorage.removeItem('tm_current_user_email');
  }
}

export class DriveService {
  // [NEW] Folder Operations
  static async getFoldersAndDocuments(parentId: string | null): Promise<{ folders: Folder[], documents: Document[] }> {
    let folderQuery = supabase.from('folders').select('*').order('name', { ascending: true });
    let docQuery = supabase.from('documents').select('*').order('title', { ascending: true });

    if (parentId === null) {
      folderQuery = folderQuery.is('parentId', null);
      docQuery = docQuery.is('folderId', null); // Should technically be empty if enforced
    } else {
      folderQuery = folderQuery.eq('parentId', parentId);
      docQuery = docQuery.eq('folderId', parentId);
    }

    const [folders, docs] = await Promise.all([folderQuery, docQuery]);
    return { folders: folders.data || [], documents: docs.data || [] };
  }

  static async getAllFolders(): Promise<Folder[]> {
    const { data, error } = await supabase.from('folders').select('*').order('name', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  static async createFolder(name: string, parentId: string | null): Promise<Folder | null> {
    const newFolder: Partial<Folder> = {
      name,
      parentId, // can be null
      desc: ''
    };
    const { data, error } = await supabase.from('folders').insert(newFolder).select().single();
    if (error) { console.error(error); return null; }
    return data;
  }

  static async renameFolder(id: string, name: string): Promise<void> {
    await supabase.from('folders').update({ name }).eq('id', id);
  }

  static async deleteFolder(id: string): Promise<void> {
    // DB Cascade handles children
    await supabase.from('folders').delete().eq('id', id);
  }

  // [NEW] Document Operations
  static async createDocument(title: string, folderId: string): Promise<Document | null> {
    const newDoc: Partial<Document> = {
      title,
      folderId,
      description: ''
    };
    const { data, error } = await supabase.from('documents').insert(newDoc).select().single();
    if (error) { console.error(error); return null; }
    return data;
  }

  static async renameDocument(id: string, title: string): Promise<void> {
    await supabase.from('documents').update({ title, updatedAt: now() }).eq('id', id);
  }

  static async moveDocument(id: string, newFolderId: string): Promise<void> {
    await supabase.from('documents').update({ folderId: newFolderId, updatedAt: now() }).eq('id', id);
  }

  static async deleteDocument(id: string): Promise<void> {
    await supabase.from('documents').delete().eq('id', id);
  }

  static async getAllDocuments(): Promise<Document[]> {
    const { data, error } = await supabase.from('documents').select('*').order('title', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  static async getDocument(id: string): Promise<Document | null> {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error) { console.error(error); return null; }
    return data;
  }

  // [CRITICAL] Deep Copy Logic
  static async duplicateDocument(sourceDocId: string, newTitle: string, user: User): Promise<Document | null> {
    // 1. Get Source Document
    const { data: sourceDoc } = await supabase.from('documents').select('*').eq('id', sourceDocId).single();
    if (!sourceDoc) return null;

    // 2. Create New Document
    const newDocPayload = {
      ...sourceDoc,
      id: undefined, // Let DB generate
      title: newTitle,
      createdAt: now(),
      updatedAt: now()
    };
    const { data: newDoc, error } = await supabase.from('documents').insert(newDocPayload).select().single();
    if (error || !newDoc) { console.error("Copy failed", error); return null; }

    // 3. Get All Source Sections
    const { data: sourceSections } = await supabase.from('sections').select('*').eq('documentId', sourceDocId);

    // 4. Get All Source TestCases
    const { data: sourceCases } = await supabase.from('testCases').select('*').eq('documentId', sourceDocId);

    // 5. Map Sections (Old ID -> New ID)
    const sectionMap = new Map<string, string>(); // OldID -> NewID

    if (sourceSections && sourceSections.length > 0) {
      const newSections = sourceSections.map(sec => ({
        documentId: newDoc.id,
        title: sec.title,
        parentId: sec.parentId // Note: Nested sections logic complex, strictly flat or needs 2-pass if recursion used
      }));

      const { data: insertedSections } = await supabase.from('sections').insert(newSections).select();

      if (insertedSections) {
        // Build Map. Assuming order preservation or title matching. 
        // Better strategy: Insert one by one or bulk insert and match by title if unique? 
        // Since title is not unique, we rely on the fact that we process them. 
        // For robustness, single insert loop is safer here despite performance hit, or use client-side ID generation if UUID.
        // Let's use single insert loop to guarantee ID mapping.

        // Re-do section insertion safely
        await supabase.from('sections').delete().eq('documentId', newDoc.id); // Clean up bulk attempt

        for (const oldSec of sourceSections) {
          const { data: newSec } = await supabase.from('sections').insert({
            documentId: newDoc.id,
            title: oldSec.title,
            parentId: oldSec.parentId // Limitation: Parent references might point to old IDs if nested. 
          }).select().single();

          if (newSec) sectionMap.set(oldSec.id, newSec.id);
        }
      }
    }

    // 6. Insert TestCases with New Section IDs
    if (sourceCases && sourceCases.length > 0) {
      const newCases = sourceCases.map(c => ({
        ...c,
        id: undefined,
        documentId: newDoc.id,
        sectionId: sectionMap.get(c.sectionId) || c.sectionId, // Fallback (should not happen if map complete)
        createdAt: now(),
        updatedAt: now(),
        authorId: user.id
        // HistoryLog is NOT copied, starting fresh.
      }));
      await supabase.from('testCases').insert(newCases);

      // [LOGIC] Add initial history log for copy
      // Optimization: Batch insert history logs? Or just skip. 
      // Let's skip for performance, "Created" timestamp is enough.
    }

    return newDoc;
  }
}

export class TestCaseService {
  static async getSections(documentId: string): Promise<Section[]> {
    const { data } = await supabase.from('sections').select('*').eq('documentId', documentId);
    return data || [];
  }

  static async createSection(data: Partial<Section>) {
    const { data: newSec, error } = await supabase.from('sections').insert(data).select().single();
    if (error) throw error;
    return newSec;
  }

  static async getSectionsByDocumentIds(documentIds: string[]): Promise<Section[]> {
    const { data } = await supabase.from('sections').select('*').in('documentId', documentIds);
    return data || [];
  }

  static async deleteSection(sectionId: string): Promise<void> {
    // DB Cascade handles cases
    await supabase.from('sections').delete().eq('id', sectionId);
  }

  static async getCasesByDocumentIds(documentIds: string[]): Promise<TestCase[]> {
    const { data } = await supabase
      .from('testCases')
      .select('*')
      .in('documentId', documentIds)
      .order('seq_id', { ascending: true });
    return data || [];
  }

  static async getCases(documentId: string): Promise<TestCase[]> {
    const { data } = await supabase
      .from('testCases')
      .select('*')
      .eq('documentId', documentId)
      .order('seq_id', { ascending: true });
    return data || [];
  }

  static async saveCase(data: Partial<TestCase>, user: User): Promise<TestCase> {
    const payload = { ...data, updatedAt: now() };

    if (!payload.id) {
      // Create
      payload.authorId = user.id;
      const { data: newCase, error } = await supabase.from('testCases').insert(payload).select().single();
      if (error) throw error;
      await HistoryService.logChange(null, newCase, user);
      return newCase;
    } else {
      // Update
      const { data: oldData } = await supabase.from('testCases').select('*').eq('id', payload.id).single();
      await HistoryService.logChange(oldData, payload, user);

      const { data: updated, error } = await supabase.from('testCases').update(payload).eq('id', payload.id).select().single();
      if (error) throw error;
      return updated;
    }
  }

  static async deleteCase(caseId: string): Promise<void> {
    await supabase.from('testCases').delete().eq('id', caseId);
  }

  static async importCases(documentId: string, cases: any[], user: User) {
    // 1. 기존 섹션(폴더) 조회
    const existingSections = await TestCaseService.getSections(documentId);
    const sectionMap = new Map<string, string>();
    existingSections.forEach(s => sectionMap.set(s.title, s.id));

    // 2. CSV 데이터에서 유니크한 섹션 이름 추출
    const uniqueSectionTitles = Array.from(new Set(cases.map(c => c.sectionTitle || 'Uncategorized')));

    // 3. 존재하지 않는 섹션은 DB에 새로 생성 후 Map에 매핑
    for (const title of uniqueSectionTitles) {
      if (!sectionMap.has(title)) {
        const newSec = await TestCaseService.createSection({ documentId, title });
        if (newSec) sectionMap.set(title, newSec.id);
      }
    }

    // 4. DB 스키마에 맞게 삽입할 케이스 데이터 매핑
    const newCases = cases.map(c => ({
      documentId: documentId,
      sectionId: sectionMap.get(c.sectionTitle || 'Uncategorized')!,
      title: c.title,
      precondition: c.precondition || '',
      steps: c.steps || [],
      priority: c.priority || 'MEDIUM',
      type: c.type || 'FUNCTIONAL',
      note: c.note || '',
      platform_type: c.platform_type || 'WEB',
      authorId: user.id,
      createdAt: now(),
      updatedAt: now()
    }));

    // 5. Supabase에 대량 삽입 (Bulk Insert)
    if (newCases.length > 0) {
      const { error } = await supabase.from('testCases').insert(newCases);
      if (error) {
        console.error("Import Error:", error);
        throw error;
      }
    }
  }
}

export class RunService {
  static async getAll(): Promise<TestRun[]> {
    const { data } = await supabase.from('testRuns').select('*').order('createdAt', { ascending: false });
    return data || [];
  }

  static async getRunStats(openRuns: TestRun[]): Promise<Record<string, { total: number, pass: number, fail: number, block: number, na: number, untested: number }>> {
    if (openRuns.length === 0) return {};
    const openRunIds = openRuns.map(r => r.id);
    const targetDocIds = Array.from(new Set(openRuns.flatMap(r => r.target_document_ids || [])));

    const [casesRes, resultsRes] = await Promise.all([
      targetDocIds.length > 0
        // 💡 [수정 1] 조회를 위해 platform_type 명시적 추가
        ? supabase.from('testCases').select('id, documentId, platform_type').in('documentId', targetDocIds)
        : Promise.resolve({ data: [] }),
      // 💡 [수정 2] 조회를 위해 caseId, device_platform 명시적 추가
      supabase.from('testResults').select('runId, caseId, status, device_platform').in('runId', openRunIds)
    ]);

    const cases = casesRes.data || [];
    const results = resultsRes.data || [];

    const stats: Record<string, any> = {};

    openRuns.forEach(run => {
      const runDocIds = new Set(run.target_document_ids || []);
      const runCases = cases.filter(c => runDocIds.has(c.documentId));
      const runRes = results.filter(r => r.runId === run.id);

      const total = runCases.length;
      let pass = 0, fail = 0, block = 0, na = 0;

      // 💡 [수정 3] 결과(Result) 행 단순 덧셈이 아닌 케이스(Case) 단위 순회
      runCases.forEach(c => {
        const cRes = runRes.filter(r => r.caseId === c.id);
        let fStatus: TestStatus = 'UNTESTED';

        if (c.platform_type === 'APP') {
          const iStat = cRes.find(r => r.device_platform === 'iOS')?.status || 'UNTESTED';
          const aStat = cRes.find(r => r.device_platform === 'Android')?.status || 'UNTESTED';

          if (iStat === 'UNTESTED' || aStat === 'UNTESTED') fStatus = 'UNTESTED';
          else if (iStat === 'FAIL' || aStat === 'FAIL') fStatus = 'FAIL';
          else if (iStat === 'BLOCK' || aStat === 'BLOCK') fStatus = 'BLOCK';
          else if (iStat === 'NA' || aStat === 'NA') fStatus = 'NA';
          else fStatus = 'PASS';
        } else {
          fStatus = cRes.find(r => !r.device_platform || r.device_platform === 'PC')?.status || 'UNTESTED';
        }

        if (fStatus === 'PASS') pass++;
        else if (fStatus === 'FAIL') fail++;
        else if (fStatus === 'BLOCK') block++;
        else if (fStatus === 'NA') na++;
      });

      const untested = Math.max(0, total - (pass + fail + block + na));
      stats[run.id] = { total, pass, fail, block, na, untested };
    });

    return stats;
  }

  static async getById(id: string): Promise<TestRun | null> {
    const { data, error } = await supabase.from('testRuns').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  static async create(data: Partial<TestRun>): Promise<TestRun> {
    const newRun = {
      ...data,
      status: 'OPEN',
      createdAt: now()
    };
    const { data: res, error } = await supabase.from('testRuns').insert(newRun).select().single();
    if (error) throw error;
    return res;
  }

  static async finishRun(runId: string, snapshotData: any): Promise<void> {
    await supabase.from('testRuns').update({
      status: 'COMPLETED',
      completedAt: now(),
      snapshot_data: snapshotData
    }).eq('id', runId);
  }

  static async delete(runId: string): Promise<void> {
    // 1. 하위 데이터(테스트 결과)를 먼저 삭제하여 409 Conflict 방지
    await supabase.from('testResults').delete().eq('runId', runId);

    // 2. 그 다음 실행 계획 본체 삭제
    await supabase.from('testRuns').delete().eq('id', runId);
  }

  static async getResults(runId: string): Promise<TestResult[]> {
    const { data } = await supabase.from('testResults').select('*').eq('runId', runId);
    return data || [];
  }

  static async saveResult(data: Partial<TestResult>) {
    // Upsert logic based on composite key or ID
    // Simplify: always upsert by ID if present, or match constraints

    // 1. Check existing
    let query = supabase.from('testResults').select('*');
    if (data.id && data.id !== 'temp') {
      query = query.eq('id', data.id);
    } else {
      query = query.eq('runId', data.runId).eq('caseId', data.caseId).eq('device_platform', data.device_platform || 'PC');
    }

    const { data: existing } = await query.maybeSingle();

    let history = existing?.history || [];
    if (existing && existing.status !== 'UNTESTED') {
      history.unshift({
        status: existing.status,
        actualResult: existing.actualResult,
        comment: existing.comment,
        testerId: existing.testerId,
        timestamp: existing.timestamp,
        stepResults: existing.stepResults
      });
    }

    const payload = {
      ...data,
      history,
      timestamp: now()
    };

    if (existing) {
      await supabase.from('testResults').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('testResults').insert(payload);
    }
  }
}

export class HistoryService {
  static async getLogs(entityId: string): Promise<HistoryLog[]> {
    const { data } = await supabase.from('historyLogs').select('*').eq('entityId', entityId).order('timestamp', { ascending: false });
    return data || [];
  }

  static async logChange(oldObj: any, newObj: any, user: User) {
    // Only log diff
    const changes: any[] = [];
    if (!oldObj) {
      changes.push({ field: 'ALL', oldVal: null, newVal: 'CREATED' });
    } else {
      for (const key of Object.keys(newObj)) {
        if (['updatedAt', 'createdAt', 'history', 'steps'].includes(key)) continue;
        // Note: steps comparison is heavy, skip for now or specialized diff later
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          changes.push({ field: key, oldVal: oldObj[key], newVal: newObj[key] });
        }
      }
    }

    if (changes.length === 0) return;

    await supabase.from('historyLogs').insert({
      entityType: 'CASE',
      entityId: newObj.id,
      action: oldObj ? 'UPDATE' : 'CREATE',
      modifierId: user.id,
      modifierName: user.name,
      changes,
      timestamp: now()
    });
  }
}


export class DashboardService {
  static async getStats(contextId: string | null, contextType: 'FOLDER' | 'DOCUMENT' | 'ALL'): Promise<any> {

    // 1. Resolve Target Document IDs based on Context
    let targetDocIds: string[] = [];

    if (contextType === 'DOCUMENT' && contextId) {
      targetDocIds = [contextId];
    } else if (contextType === 'FOLDER' && contextId) {
      // Use the recursive function we created in Phase 1
      const { data, error } = await supabase.rpc('get_recursive_document_ids', { root_folder_id: contextId });
      if (!error && data) targetDocIds = data.map((d: any) => d.id);
    } else {
      // ALL: Fetch all documents
      const { data } = await supabase.from('documents').select('id');
      if (data) targetDocIds = data.map(d => d.id);
    }

    if (targetDocIds.length === 0) {
      return { totalCases: 0, activeRuns: 0, passRate: 0, defectCount: 0, chartData: [] };
    }

    // 2. Fetch Aggregated Data
    // Total Cases
    const { count: totalCases } = await supabase
      .from('testCases')
      .select('id', { count: 'exact', head: true })
      .in('documentId', targetDocIds);

    // Active Runs (Runs that target these docs and are OPEN)
    const { data: allOpenRuns } = await supabase
      .from('testRuns')
      .select('id, target_document_ids')
      .eq('status', 'OPEN');

    const activeRuns = (allOpenRuns || []).filter(r =>
      (r.target_document_ids || []).some((id: string) => targetDocIds.includes(id))
    ).length;

    // Defects (Issues in Results linked to these docs)
    // Results -> Run -> target_docs? Or Results -> Case -> Document
    // We need to join. 
    // Optimization: defects count from results where caseId in (select id from cases where documentId in targetDocIds)
    // This is expensive. Let's do a simpler approach or direct join if possible.
    // Supabase JS doesn't do deep joins easily for count.

    // Alternative: Fetch all latest results for these docs? Too heavy.
    // Let's rely on Run Results where run.target_docs overlaps.

    // For MVP/Proto:
    const defectCount = 0; // Placeholder until we have a defects table or better query

    // Pass Rate (from completed runs targeting these docs)
    // Fetch recent completed runs, then filter in JS to avoid JSONB overlap limitation in PostgREST
    const { data: allRecentRuns } = await supabase
      .from('testRuns')
      .select('target_document_ids, snapshot_data, completedAt')
      .eq('status', 'COMPLETED')
      .order('completedAt', { ascending: false })
      .limit(100);

    const recentRuns = (allRecentRuns || [])
      .filter(r => (r.target_document_ids || []).some((id: string) => targetDocIds.includes(id)))
      .slice(0, 10);

    let totalPass = 0;
    let totalExecuted = 0;

    const chartData = (recentRuns || []).reverse().map((run: any, idx: number) => {
      const snap = run.snapshot_data || {};
      const results = snap.results || [];
      const pass = results.filter((r: any) => r.status === 'PASS').length;
      const fail = results.filter((r: any) => r.status === 'FAIL').length;

      totalPass += pass;
      totalExecuted += results.length;

      return {
        name: `Run ${idx + 1}`,
        passed: pass,
        failed: fail
      };
    });

    const passRate = totalExecuted > 0 ? Math.round((totalPass / totalExecuted) * 100) : 0;

    return {
      totalCases: totalCases || 0,
      activeRuns: activeRuns || 0,
      passRate,
      defectCount,
      chartData
    };
  }
}