import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Layout, LayoutDashboard, FolderTree, PlayCircle, Settings, Users, LogOut, 
  Plus, ChevronRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Clock, Save, History, Search, Filter,
  Download, Upload, FileText, AlertTriangle, ArrowRightLeft, ArrowRight, CheckSquare, Square,
  Play, PauseCircle, SkipForward, ArrowLeft, MoreVertical, Edit, Archive, Folder, Grid, List, Trash2, Bug, ExternalLink, BarChart2,
  Table, Link as LinkIcon, MinusCircle, HelpCircle
} from 'lucide-react';
import { 
  AuthService, ProjectService, TestCaseService, RunService, HistoryService 
} from './storage';
import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, TestStep, Role, TestStatus, ProjectStatus, Issue 
} from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// --- Contexts ---

const AuthContext = createContext<{
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
}>({ user: null, login: async () => {}, logout: () => {} });

// --- Utilities for Import/Export ---

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; 
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
};

const exportToCSV = (cases: TestCase[], sections: Section[]) => {
  const sectionMap = new Map(sections.map(s => [s.id, s.title]));
  const headers = ['Section', 'Title', 'Priority', 'Type', 'Precondition', 'Step Action', 'Step Expected'];
  
  const rows: string[][] = [];
  rows.push(headers);

  cases.forEach(tc => {
    const sectionTitle = sectionMap.get(tc.sectionId) || '';
    const firstStep = tc.steps[0] || { step: '', expected: '' };
    rows.push([
      sectionTitle,
      tc.title,
      tc.priority,
      tc.type,
      tc.precondition.replace(/\n/g, '\\n'),
      firstStep.step.replace(/\n/g, '\\n'),
      firstStep.expected.replace(/\n/g, '\\n')
    ]);

    for (let i = 1; i < tc.steps.length; i++) {
      rows.push([
        '', '', '', '', '',
        tc.steps[i].step.replace(/\n/g, '\\n'),
        tc.steps[i].expected.replace(/\n/g, '\\n')
      ]);
    }
  });

  const csvContent = rows.map(row => 
    row.map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `test_cases_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};

const exportToJSON = (cases: TestCase[]) => {
  const jsonContent = JSON.stringify(cases, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `test_cases_backup_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
};

// Smart Normalizer for Imports
const normalizePriority = (val: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  const v = val ? val.toUpperCase().trim() : '';
  if (['HIGH', 'H', '상', 'A', '1', 'URGENT'].includes(v)) return 'HIGH';
  if (['LOW', 'L', '하', 'C', '3'].includes(v)) return 'LOW';
  return 'MEDIUM'; // Default to Medium for 'MEDIUM', 'M', '중', 'B', '2', or unknown
};

const normalizeType = (val: string): 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY' => {
  const v = val ? val.toUpperCase().trim() : '';
  if (v.includes('UI') || v.includes('유저') || v.includes('화면')) return 'UI';
  if (v.includes('PERF') || v.includes('성능')) return 'PERFORMANCE';
  if (v.includes('SEC') || v.includes('보안')) return 'SECURITY';
  return 'FUNCTIONAL'; // Default
};

// --- Components ---

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('admin@company.com');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">QA 관리 도구</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <input 
              type="email" 
              className="mt-1 block w-full p-2 border rounded" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="admin@company.com"
            />
          </div>
          <div className="text-xs text-gray-500">
            <p>테스트 계정: admin@company.com (관리자)</p>
            <p>테스트 계정: jane@company.com (내부 QA)</p>
            <p>테스트 계정: ext@vendor.com (외부 QA)</p>
          </div>
          <button disabled={loading} type="submit" className="w-full bg-primary text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Generic Simple Input Modal
const SimpleInputModal = ({ 
  isOpen, onClose, title, label, placeholder, onSubmit 
}: { 
  isOpen: boolean, onClose: () => void, title: string, label: string, placeholder: string, onSubmit: (val: string) => void 
}) => {
  const [value, setValue] = useState('');
  
  useEffect(() => {
    if(isOpen) setValue('');
  }, [isOpen]);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <input 
            autoFocus
            className="w-full border rounded p-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onSubmit(value);
                setValue('');
              }
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded">취소</button>
          <button 
            onClick={() => {
              if(value.trim()) { onSubmit(value); setValue(''); }
            }} 
            className="px-3 py-1 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={!value.trim()}
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
};

// Project Create/Edit Modal
const ProjectModal = ({
  isOpen, onClose, onSubmit, initialData
}: {
  isOpen: boolean, onClose: () => void, onSubmit: (title: string, desc: string, status: ProjectStatus) => void, initialData?: Project
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setDesc(initialData.description);
        setStatus(initialData.status);
      } else {
        setTitle('');
        setDesc('');
        setStatus('ACTIVE');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
        <h3 className="text-lg font-bold mb-4">{initialData ? '프로젝트 수정' : '새 프로젝트 생성'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트 명</label>
            <input 
              className="w-full border rounded p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2024 상반기 앱 개편"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea 
              className="w-full border rounded p-2 h-24"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="프로젝트에 대한 간단한 설명을 입력하세요."
            />
          </div>
          {initialData && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select 
                  className="w-full border rounded p-2"
                  value={status}
                  onChange={e => setStatus(e.target.value as ProjectStatus)}
                >
                  <option value="ACTIVE">진행 중 (Active)</option>
                  <option value="ARCHIVED">보관됨 (Archived)</option>
                </select>
             </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded">취소</button>
          <button 
            onClick={async () => {
              if(title.trim()) { 
                setLoading(true);
                await onSubmit(title, desc, status); 
                setLoading(false);
                onClose(); 
              }
            }} 
            className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50 font-bold"
            disabled={!title.trim() || loading}
          >
            {loading ? '처리 중...' : (initialData ? '수정 완료' : '프로젝트 생성')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Run Creation Modal
const RunCreationModal = ({
  isOpen, onClose, project, onSubmit
}: {
  isOpen: boolean, onClose: () => void, project: Project, onSubmit: (title: string, caseIds: string[]) => void
}) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [sections, setSections] = useState<Section[]>([]);
  const [allCases, setAllCases] = useState<TestCase[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setMode('ALL');
      setLoadingData(true);
      Promise.all([
        TestCaseService.getSections(project.id),
        TestCaseService.getCases(project.id)
      ]).then(([s, c]) => {
        setSections(s);
        setAllCases(c);
        setSelectedCaseIds(new Set(c.map(tc => tc.id)));
        setLoadingData(false);
      });
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const toggleCase = (id: string) => {
    const newSet = new Set(selectedCaseIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCaseIds(newSet);
  };

  const toggleSection = (sectionId: string, casesInSection: TestCase[]) => {
    const ids = casesInSection.map(c => c.id);
    const allSelected = ids.every(id => selectedCaseIds.has(id));
    const newSet = new Set(selectedCaseIds);
    if (allSelected) {
      ids.forEach(id => newSet.delete(id));
    } else {
      ids.forEach(id => newSet.add(id));
    }
    setSelectedCaseIds(newSet);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("실행 계획 제목을 입력해주세요.");
      return;
    }
    const finalIds = mode === 'ALL' 
      ? allCases.map(c => c.id) 
      : Array.from(selectedCaseIds);
    if (finalIds.length === 0) {
      alert("최소 1개 이상의 테스트 케이스를 선택해야 합니다.");
      return;
    }
    setCreating(true);
    await onSubmit(title, finalIds);
    setCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-bold text-lg">새 테스트 실행 (Run) 생성</h3>
          <button onClick={onClose}><XCircle size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">제목 <span className="text-red-500">*</span></label>
            <input 
              className="w-full border rounded p-2"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: v2.0 정기 배포 회귀 테스트"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">테스트 케이스 선택</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === 'ALL'} onChange={() => setMode('ALL')} />
                <span>모든 케이스 포함 ({allCases.length}개)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === 'CUSTOM'} onChange={() => setMode('CUSTOM')} />
                <span>특정 케이스 선택하기</span>
              </label>
            </div>
          </div>
          {loadingData ? (
             <div className="p-4 text-center text-gray-500">데이터 로딩 중...</div>
          ) : mode === 'CUSTOM' && (
            <div className="border rounded h-64 overflow-y-auto p-2 bg-gray-50">
              {sections.length === 0 && allCases.length === 0 && <p className="text-sm text-gray-500 p-2">데이터가 없습니다.</p>}
              {sections.map(sec => {
                const secCases = allCases.filter(c => c.sectionId === sec.id);
                if (secCases.length === 0) return null;
                const allSecSelected = secCases.every(c => selectedCaseIds.has(c.id));
                const someSecSelected = secCases.some(c => selectedCaseIds.has(c.id));
                return (
                  <div key={sec.id} className="mb-2">
                    <div className="flex items-center gap-2 py-1 hover:bg-gray-100 rounded px-1">
                      <button onClick={() => toggleSection(sec.id, secCases)}>
                        {allSecSelected ? <CheckSquare size={16} className="text-primary"/> : 
                         someSecSelected ? <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center"><div className="w-2 h-0.5 bg-white"></div></div> : 
                         <Square size={16} className="text-gray-400"/>}
                      </button>
                      <FolderTree size={16} className="text-gray-500" />
                      <span className="font-semibold text-sm">{sec.title}</span>
                    </div>
                    <div className="pl-6 space-y-1 mt-1">
                      {secCases.map(tc => (
                        <div key={tc.id} className="flex items-center gap-2 text-sm hover:bg-blue-50 px-1 rounded cursor-pointer" onClick={() => toggleCase(tc.id)}>
                          {selectedCaseIds.has(tc.id) ? <CheckSquare size={14} className="text-primary"/> : <Square size={14} className="text-gray-400"/>}
                          <span className="truncate">{tc.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Uncategorized */}
              {(() => {
                 const uncategorized = allCases.filter(c => !sections.find(s => s.id === c.sectionId));
                 if (uncategorized.length === 0) return null;
                 return (
                   <div className="mb-2">
                     <div className="flex items-center gap-2 py-1 font-semibold text-gray-500"><FolderTree size={16} /> 미분류</div>
                     <div className="pl-6 space-y-1">
                       {uncategorized.map(tc => (
                         <div key={tc.id} className="flex items-center gap-2 text-sm hover:bg-blue-50 px-1 rounded cursor-pointer" onClick={() => toggleCase(tc.id)}>
                            {selectedCaseIds.has(tc.id) ? <CheckSquare size={14} className="text-primary"/> : <Square size={14} className="text-gray-400"/>}
                            <span className="truncate">{tc.title}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 );
              })()}
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-white text-gray-700">취소</button>
          <button disabled={creating} onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 shadow-sm disabled:opacity-50">
            {creating ? '생성 중...' : '실행 계획 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Report Generation Modal
const ReportModal = ({
  isOpen, onClose, project
}: {
  isOpen: boolean, onClose: () => void, project: Project
}) => {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [reportData, setReportData] = useState<{
    run: TestRun,
    results: TestResult[],
    pass: number,
    fail: number,
    untested: number,
    allDefects: { issue: Issue, caseTitle: string }[]
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      RunService.getAll(project.id).then(setRuns);
      setSelectedRunId('');
      setReportData(null);
    }
  }, [isOpen, project]);

  useEffect(() => {
    if (selectedRunId) {
      const run = runs.find(r => r.id === selectedRunId);
      if (run) {
        Promise.all([
          RunService.getResults(run.id),
          TestCaseService.getCases(project.id)
        ]).then(([results, cases]) => {
            const pass = results.filter(r => r.status === 'PASS').length;
            const fail = results.filter(r => r.status === 'FAIL').length;
            const untested = (run.caseIds?.length || 0) - results.length;
            
            const allDefects: { issue: Issue, caseTitle: string }[] = [];
            const caseMap = new Map(cases.map(c => [c.id, c.title]));

            results.forEach(res => {
              if (res.issues && res.issues.length > 0) {
                res.issues.forEach(issue => {
                  allDefects.push({ issue, caseTitle: caseMap.get(res.caseId) || 'Unknown Case' });
                });
              }
            });
            setReportData({ run, results, pass, fail, untested, allDefects });
        });
      }
    }
  }, [selectedRunId, runs, project]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-xl w-[900px] h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-bold text-lg flex items-center gap-2"><BarChart2 size={20}/> 테스트 리포트 생성</h3>
          <button onClick={onClose}><XCircle size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
           <div className="mb-8">
             <label className="block text-sm font-bold text-gray-700 mb-2">분석할 실행(Run) 선택</label>
             <select className="w-full border rounded p-2 text-lg" value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
               <option value="">-- 테스트 실행 선택 --</option>
               {runs.map(r => (
                 <option key={r.id} value={r.id}>{r.title} ({new Date(r.createdAt).toLocaleDateString()})</option>
               ))}
             </select>
           </div>
           {reportData ? (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded border border-blue-100 text-center">
                    <div className="text-sm text-blue-600 font-semibold uppercase">Total Cases</div>
                    <div className="text-3xl font-bold text-blue-900">{reportData.run.caseIds?.length || 0}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded border border-green-100 text-center">
                    <div className="text-sm text-green-600 font-semibold uppercase">Passed</div>
                    <div className="text-3xl font-bold text-green-900">{reportData.pass}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded border border-red-100 text-center">
                    <div className="text-sm text-red-600 font-semibold uppercase">Failed</div>
                    <div className="text-3xl font-bold text-red-900">{reportData.fail}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center">
                    <div className="text-sm text-gray-500 font-semibold uppercase">Untested</div>
                    <div className="text-3xl font-bold text-gray-700">{reportData.untested}</div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-8">
                 <div className="bg-white border rounded p-4 h-80 shadow-sm">
                    <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">최종 상태 분포 (Status Distribution)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                         <Pie
                           data={[
                             { name: 'Pass', value: reportData.pass, fill: '#22c55e' },
                             { name: 'Fail', value: reportData.fail, fill: '#ef4444' },
                             { name: 'Untested', value: reportData.untested, fill: '#e5e7eb' }
                           ]}
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                         >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                            <Cell fill="#e5e7eb" />
                         </Pie>
                         <Tooltip />
                         <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="bg-white border rounded p-4 h-80 shadow-sm flex flex-col">
                    <h4 className="font-bold text-gray-700 mb-4 border-b pb-2 flex justify-between">
                      <span>발생 결함 목록 (Defects)</span>
                      <span className="bg-red-100 text-red-700 px-2 rounded text-sm">{reportData.allDefects.length}</span>
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                       {reportData.allDefects.length === 0 ? (
                         <div className="text-center text-gray-400 py-10">발견된 결함이 없습니다.</div>
                       ) : (
                         reportData.allDefects.map((d, i) => (
                           <div key={i} className="p-3 bg-red-50 border border-red-100 rounded hover:bg-red-100 transition">
                             <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                               <FileText size={10} /> {d.caseTitle}
                             </div>
                             <a href={d.issue.url} target="_blank" rel="noreferrer" className="text-red-700 font-bold hover:underline flex items-center gap-1">
                               <Bug size={14} /> {d.issue.label} <ExternalLink size={12} />
                             </a>
                           </div>
                         ))
                       )}
                    </div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400">
               테스트 실행을 선택하면 보고서가 생성됩니다.
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ project }: { project: Project }) => {
  const [stats, setStats] = useState({ total: 0, automated: 0, runs: 0, passRate: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isReportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      TestCaseService.getCases(project.id),
      RunService.getAll(project.id)
    ]).then(([cases, runs]) => {
      setStats({
        total: cases.length,
        automated: 0,
        runs: runs.length,
        passRate: 75 
      });
    });
    
    setChartData([
      { name: '월', passed: 40, failed: 24 },
      { name: '화', passed: 30, failed: 13 },
      { name: '수', passed: 20, failed: 58 },
      { name: '목', passed: 27, failed: 39 },
      { name: '금', passed: 18, failed: 48 },
    ]);
  }, [project]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-gray-800">대시보드: {project.title}</h2>
         <button onClick={() => setReportModalOpen(true)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded shadow-sm hover:bg-gray-50 flex items-center gap-2">
           <BarChart2 size={18} /> 보고서 생성
         </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">총 테스트 케이스</h3>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">진행 중인 테스트 실행</h3>
          <p className="text-3xl font-bold">{stats.runs}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">평균 통과율</h3>
          <p className="text-3xl font-bold text-green-600">{stats.passRate}%</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">오픈된 결함(Defects)</h3>
          <p className="text-3xl font-bold text-red-500">12</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded shadow h-80">
        <h3 className="text-lg font-semibold mb-4">최근 활동 (지난 7일)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar name="성공(Passed)" dataKey="passed" fill="#22c55e" />
            <Bar name="실패(Failed)" dataKey="failed" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} project={project} />
    </div>
  );
};

// [NEW] Import/Export Modal with Column Mapping
const ImportExportModal = ({ 
  isOpen, onClose, project, cases, sections, onImportSuccess 
}: { 
  isOpen: boolean, onClose: () => void, project: Project, cases: TestCase[], sections: Section[], onImportSuccess: () => void 
}) => {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [step, setStep] = useState<'UPLOAD' | 'MAP'>('UPLOAD');
  const [csvMatrix, setCsvMatrix] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [headerRowIndex, setHeaderRowIndex] = useState(0); // [NEW] Track detected header row
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const APP_FIELDS = [
    { key: 'section', label: '섹션 (Section/Folder)', required: false },
    { key: 'title', label: '제목 (Title)', required: true },
    { key: 'priority', label: '우선순위 (Priority)', required: false },
    { key: 'type', label: '유형 (Type)', required: false },
    { key: 'precondition', label: '사전조건 (Precondition)', required: false },
    { key: 'step', label: '단계 (Step Action)', required: false },
    { key: 'expected', label: '기대결과 (Expected Result)', required: false },
  ];

  useEffect(() => {
    if (isOpen) {
      setTab('EXPORT');
      setStep('UPLOAD');
      setCsvMatrix([]);
      setMapping({});
      setHeaderRowIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCsvText(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processCsvText = (text: string) => {
    try {
      const rows = parseCSV(text);
      if (rows.length < 1) {
        alert("데이터가 없습니다.");
        return;
      }
      
      // [IMPROVED] Intelligent Header Detection
      // Instead of blindly taking rows[0], scan the first 20 rows to find the best candidate for the header.
      let bestIndex = 0;
      let bestScore = -1;
      const SCAN_LIMIT = Math.min(rows.length, 20);
      const KEYWORDS = ['title', '제목', 'section', '섹션', 'folder', '폴더', 'priority', '우선순위', '중요도', 'type', '유형', 'step', '단계', '절차', 'expected', '기대', '결과'];

      for (let i = 0; i < SCAN_LIMIT; i++) {
        const row = rows[i];
        // Filter out empty rows entirely to avoid selecting them
        if (!row.some(c => c && c.trim() !== '')) continue;

        let score = 0;
        row.forEach(cell => {
          if (cell && typeof cell === 'string') {
            const val = cell.toLowerCase().trim();
            if (KEYWORDS.some(k => val.includes(k))) score++;
          }
        });

        // Use strict inequality to prefer earlier rows if scores match, but here higher score wins
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      
      // Fallback: If no keywords matched (score <= 0), default to first non-empty row
      if (bestScore <= 0) {
         for(let i=0; i<SCAN_LIMIT; i++){
             if(rows[i].some(c => c && c.trim() !== '')) {
                 bestIndex = i;
                 break;
             }
         }
      }

      setCsvMatrix(rows);
      setHeaderRowIndex(bestIndex);
      
      const headers = rows[bestIndex];
      setCsvHeaders(headers);
      
      const initialMapping: Record<string, number> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        const header = h.toLowerCase().trim();
        if (header.includes('title') || header.includes('제목')) initialMapping['title'] = idx;
        else if (header.includes('section') || header.includes('folder') || header.includes('섹션')) initialMapping['section'] = idx;
        else if (header.includes('priority') || header.includes('우선순위') || header.includes('중요도')) initialMapping['priority'] = idx;
        else if (header.includes('type') || header.includes('유형')) initialMapping['type'] = idx;
        else if (header.includes('precondition') || header.includes('사전')) initialMapping['precondition'] = idx;
        else if (header.includes('step') || header.includes('action') || header.includes('단계') || header.includes('절차')) initialMapping['step'] = idx;
        else if (header.includes('expected') || header.includes('result') || header.includes('기대') || header.includes('예상')) initialMapping['expected'] = idx;
      });
      setMapping(initialMapping);
      setStep('MAP');
    } catch (e) {
      alert("CSV 파싱 중 오류가 발생했습니다.");
    }
  };

  const finalizeImport = async () => {
    if (!user) return;
    if (mapping['title'] === undefined) {
      alert("제목(Title) 컬럼은 반드시 매핑해야 합니다.");
      return;
    }

    const newCases: any[] = [];
    let currentCase: any = null;

    // [IMPROVED] Start iterating from the row *after* the detected header
    for (let i = headerRowIndex + 1; i < csvMatrix.length; i++) {
      const row = csvMatrix[i];
      if (row.length === 0) continue;
      const getVal = (key: string) => {
        const idx = mapping[key];
        return (idx !== undefined && row[idx]) ? row[idx] : '';
      };
      const title = getVal('title');
      
      if (title && title.trim()) {
        currentCase = {
          sectionTitle: getVal('section'),
          title: title,
          priority: normalizePriority(getVal('priority')),
          type: normalizeType(getVal('type')),
          precondition: getVal('precondition'),
          steps: []
        };
        const s = getVal('step');
        const e = getVal('expected');
        if (s || e) {
          currentCase.steps.push({ id: Math.random().toString(36).substr(2, 9), step: s, expected: e });
        }
        newCases.push(currentCase);
      } else if (currentCase) {
        const s = getVal('step');
        const e = getVal('expected');
        if (s || e) {
          currentCase.steps.push({ id: Math.random().toString(36).substr(2, 9), step: s, expected: e });
        }
      }
    }

    if (newCases.length === 0) {
      alert("가져올 케이스가 없습니다. 매핑이나 CSV 내용을 확인해주세요.");
      return;
    }
    setImporting(true);
    await (TestCaseService as any).importCases(project.id, newCases, user);
    setImporting(false);
    onImportSuccess();
    onClose();
    alert(`${newCases.length}개의 테스트 케이스를 성공적으로 가져왔습니다.`);
  };

  // Helper to find the best preview row (skipping empty rows or finding first title match)
  const getPreviewRow = () => {
    if (csvMatrix.length <= headerRowIndex + 1) return null;
    
    // If title is mapped, try to find the first row with a value in that column, searching after header
    const titleIdx = mapping['title'];
    if (titleIdx !== undefined) {
      // Check up to 5 rows to find a valid title
      for (let i = headerRowIndex + 1; i < Math.min(csvMatrix.length, headerRowIndex + 6); i++) {
        if (csvMatrix[i][titleIdx] && csvMatrix[i][titleIdx].trim() !== '') {
          return csvMatrix[i];
        }
      }
    }

    // Fallback: Check if next row has any data
    if (csvMatrix.length > headerRowIndex + 1 && csvMatrix[headerRowIndex + 1].some(cell => cell && cell.trim() !== '')) return csvMatrix[headerRowIndex + 1];
    
    return csvMatrix[headerRowIndex + 1];
  };

  const previewRow = getPreviewRow();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[800px] h-[650px] flex flex-col">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2"><ArrowRightLeft size={20}/> 데이터 가져오기 / 내보내기</h3>
        <div className="flex gap-1 bg-gray-100 p-1 rounded mb-4">
           <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'EXPORT' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('EXPORT')}>내보내기 (Export)</button>
           <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'IMPORT' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('IMPORT')}>가져오기 (Import)</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === 'EXPORT' ? (
            <div className="space-y-6 p-2">
               <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileText size={18}/> CSV로 내보내기</h4>
                  <p className="text-sm text-blue-600 mb-4">엑셀이나 구글 스프레드시트에서 편집할 수 있는 CSV 형식입니다.</p>
                  <button onClick={() => exportToCSV(cases, sections)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 font-bold text-sm"><Download size={16} /> CSV 다운로드</button>
               </div>
               <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Bug size={18}/> JSON 백업</h4>
                  <p className="text-sm text-gray-600 mb-4">데이터 전체 구조를 보존할 수 있는 JSON 형식입니다.</p>
                  <button onClick={() => exportToJSON(cases)} className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-800 flex items-center gap-2 font-bold text-sm"><Download size={16} /> JSON 다운로드</button>
               </div>
            </div>
          ) : (
             <div className="h-full flex flex-col">
                {step === 'UPLOAD' ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-100">
                       <div className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={14} /> 주의사항</div>
                       CSV 파일을 업로드하면 <strong>컬럼 매핑 단계</strong>로 이동합니다. 첫 번째 행(Header)을 기준으로 매핑을 시도합니다.
                    </div>
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-primary cursor-pointer transition group">
                        <Upload size={48} className="mb-4 text-gray-400 group-hover:text-primary transition-colors" />
                        <span className="text-lg font-bold text-gray-600 group-hover:text-primary">CSV 파일 업로드</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <textarea 
                        className="flex-1 w-full border rounded p-3 text-sm font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary outline-none resize-none"
                        placeholder={`Section,Title,Priority,Type\n"Auth","Login Test","HIGH","FUNCTIONAL"`}
                        onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData('text'); processCsvText(text); }}
                      />
                      <p className="text-xs text-center text-gray-400 mt-2">위 영역에 붙여넣기 하면 자동으로 분석합니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-4">
                     <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-lg text-gray-800">컬럼 매핑 (Map Columns)</h4>
                        <button onClick={() => setStep('UPLOAD')} className="text-sm text-gray-500 hover:underline">파일 다시 선택</button>
                     </div>
                     <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
                        <div className="overflow-y-auto pr-2 space-y-3">
                           {APP_FIELDS.map(field => (
                             <div key={field.key} className="bg-gray-50 p-3 rounded border">
                                <label className="block text-sm font-bold text-gray-700 mb-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                                <select className="w-full border rounded p-2 text-sm bg-white" value={mapping[field.key] !== undefined ? mapping[field.key] : ''} onChange={(e) => setMapping({...mapping, [field.key]: parseInt(e.target.value)})}>
                                   <option value="">(무시하기 / 매핑 안함)</option>
                                   {csvHeaders.map((h, idx) => (<option key={idx} value={idx}>{h} (Col {idx+1})</option>))}
                                </select>
                             </div>
                           ))}
                        </div>
                        <div className="bg-gray-900 rounded p-4 text-gray-300 font-mono text-xs overflow-auto">
                           <div className="font-bold text-white border-b border-gray-700 pb-2 mb-2">데이터 미리보기 (데이터가 존재하는 행)</div>
                           {previewRow ? (
                             <div className="space-y-2">
                               {APP_FIELDS.map(field => {
                                 const idx = mapping[field.key];
                                 const val = (idx !== undefined && previewRow[idx]) ? previewRow[idx] : '(empty)';
                                 return (<div key={field.key} className="flex"><span className="w-32 text-gray-500 text-right mr-3">{field.key}:</span><span className="text-green-400">{val}</span></div>);
                               })}
                             </div>
                           ) : (<div className="text-gray-500">데이터가 없습니다.</div>)}
                        </div>
                     </div>
                  </div>
                )}
             </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">닫기</button>
          {tab === 'IMPORT' && step === 'MAP' && (
             <button disabled={importing} onClick={finalizeImport} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 font-bold flex items-center gap-2 disabled:opacity-50">
               {importing ? '처리 중...' : <><Download size={16} /> 가져오기 완료</>}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};