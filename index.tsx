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
      setCsvMatrix(rows);
      const headers = rows[0];
      setCsvHeaders(headers);
      const initialMapping: Record<string, number> = {};
      headers.forEach((h, idx) => {
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

    for (let i = 1; i < csvMatrix.length; i++) {
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
      alert("가져올 케이스가 없습니다.");
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
    if (csvMatrix.length <= 1) return null;
    
    // If title is mapped, try to find the first row with a value in that column
    const titleIdx = mapping['title'];
    if (titleIdx !== undefined) {
      // Check up to 5 rows to find a valid title
      for (let i = 1; i < Math.min(csvMatrix.length, 6); i++) {
        if (csvMatrix[i][titleIdx] && csvMatrix[i][titleIdx].trim() !== '') {
          return csvMatrix[i];
        }
      }
    }

    // Fallback: Check if row 1 has any data
    if (csvMatrix.length > 1 && csvMatrix[1].some(cell => cell && cell.trim() !== '')) return csvMatrix[1];
    
    // If row 1 is basically empty, try row 2
    if (csvMatrix.length > 2) return csvMatrix[2];
    
    return csvMatrix[1];
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

// TestCase Manager
const TestCaseManager = ({ project }: { project: Project }) => {
  const { user } = useContext(AuthContext);
  const [sections, setSections] = useState<Section[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isSectionModalOpen, setSectionModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<TestCase>>({});
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, [project]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      TestCaseService.getSections(project.id),
      TestCaseService.getCases(project.id)
    ]).then(([s, c]) => {
      setSections(s);
      setCases(c);
      setLoading(false);
    });
  };

  const handleCreateSection = async (name: string) => {
    await TestCaseService.createSection({ projectId: project.id, title: name });
    loadData();
    setSectionModalOpen(false);
  };

  const handleSelectCase = async (tc: TestCase) => {
    setSelectedCase(tc);
    setIsEditing(false);
    const logs = await HistoryService.getLogs(tc.id);
    setHistoryLogs(logs);
  };

  const handleCreateCase = () => {
    if (!selectedSectionId) { alert("먼저 섹션을 선택해주세요."); return; }
    const newCase: Partial<TestCase> = {
      sectionId: selectedSectionId, projectId: project.id, title: '새 테스트 케이스', priority: 'MEDIUM', type: 'FUNCTIONAL', steps: [{ id: '1', step: '', expected: '' }], authorId: user?.id
    };
    setFormData(newCase);
    setSelectedCase(null);
    setIsEditing(true);
  };

  const handleEditCase = () => {
    if (!selectedCase) return;
    if (user?.role === 'EXTERNAL') return;
    if (user?.role === 'INTERNAL' && selectedCase.authorId !== user.id) { alert("본인이 작성한 케이스만 수정할 수 있습니다."); return; }
    setFormData({ ...selectedCase });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.title || !user) return;
    const saved = await TestCaseService.saveCase(formData, user);
    setIsEditing(false);
    setSelectedCase(saved);
    loadData();
    const logs = await HistoryService.getLogs(saved.id);
    setHistoryLogs(logs);
  };

  const filteredCases = selectedSectionId ? cases.filter(c => c.sectionId === selectedSectionId) : cases;

  return (
    <>
      <div className="flex h-full border-t">
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2"><FolderTree size={16} /> 섹션 (폴더)</h3>
            {user?.role !== 'EXTERNAL' && (<button onClick={() => setSectionModalOpen(true)} className="text-primary hover:bg-blue-100 p-1 rounded"><Plus size={16} /></button>)}
          </div>
          <div className="space-y-1">
            <div className={`cursor-pointer p-2 rounded text-sm ${selectedSectionId === null ? 'bg-blue-100 text-primary' : 'hover:bg-gray-200'}`} onClick={() => setSelectedSectionId(null)}>전체 케이스 보기</div>
            {sections.map(sec => (
              <div key={sec.id} className={`cursor-pointer p-2 rounded text-sm flex items-center gap-2 ${selectedSectionId === sec.id ? 'bg-blue-100 text-primary' : 'hover:bg-gray-200'}`} onClick={() => setSelectedSectionId(sec.id)}><FolderTree size={14} className="text-gray-400" />{sec.title}</div>
            ))}
          </div>
        </div>
        <div className="w-1/3 border-r bg-white overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">{loading ? '로딩 중...' : `${filteredCases.length}개의 케이스`}</h3>
            <div className="flex gap-2">
              {user?.role !== 'EXTERNAL' && (
                <>
                  <button onClick={() => setImportModalOpen(true)} className="px-2 py-1 border rounded text-xs hover:bg-gray-50 flex items-center gap-1"><Download size={12} className="rotate-180" /> 가져오기/내보내기</button>
                  <button onClick={handleCreateCase} className="bg-primary text-white px-3 py-1 rounded text-sm flex items-center gap-1"><Plus size={14} /> 신규 생성</button>
                </>
              )}
            </div>
          </div>
          <div className="divide-y">
            {filteredCases.map(tc => (
              <div key={tc.id} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedCase?.id === tc.id ? 'border-l-4 border-primary bg-blue-50' : ''}`} onClick={() => handleSelectCase(tc)}>
                <div className="font-medium text-sm text-gray-900">{tc.title}</div>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tc.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{tc.priority}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{tc.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white p-6 overflow-y-auto">
          {isEditing ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">케이스 수정</h2>
                <div className="flex gap-2"><button onClick={() => setIsEditing(false)} className="px-3 py-1 border rounded hover:bg-gray-50">취소</button><button onClick={handleSave} className="px-3 py-1 bg-primary text-white rounded hover:bg-blue-600 flex items-center gap-1"><Save size={14} /> 저장</button></div>
              </div>
              <input className="w-full text-lg font-semibold p-2 border rounded" placeholder="케이스 제목 입력" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">우선순위</label>
                  <select className="mt-1 block w-full p-2 border rounded" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">유형</label>
                  <select className="mt-1 block w-full p-2 border rounded" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}><option value="FUNCTIONAL">Functional</option><option value="UI">UI</option><option value="PERFORMANCE">Performance</option><option value="SECURITY">Security</option></select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사전 조건</label>
                <textarea className="w-full p-2 border rounded h-20" value={formData.precondition || ''} onChange={e => setFormData({ ...formData, precondition: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">테스트 단계</label>
                <table className="w-full border-collapse border">
                  <thead><tr className="bg-gray-100"><th className="border p-2 w-10">#</th><th className="border p-2">수행 절차</th><th className="border p-2">기대 결과</th><th className="border p-2 w-10"></th></tr></thead>
                  <tbody>
                    {(formData.steps || []).map((step, idx) => (
                      <tr key={idx}>
                        <td className="border p-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="border p-0"><textarea className="w-full h-full p-2 resize-none outline-none" rows={2} value={step.step} onChange={e => { const newSteps = [...(formData.steps || [])]; newSteps[idx].step = e.target.value; setFormData({ ...formData, steps: newSteps }); }} /></td>
                        <td className="border p-0"><textarea className="w-full h-full p-2 resize-none outline-none" rows={2} value={step.expected} onChange={e => { const newSteps = [...(formData.steps || [])]; newSteps[idx].expected = e.target.value; setFormData({ ...formData, steps: newSteps }); }} /></td>
                        <td className="border p-2 text-center"><button className="text-red-500" onClick={() => { const newSteps = [...(formData.steps || [])].filter((_, i) => i !== idx); setFormData({ ...formData, steps: newSteps }); }}><XCircle size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="mt-2 text-primary hover:text-blue-700 text-sm font-medium flex items-center gap-1" onClick={() => setFormData({ ...formData, steps: [...(formData.steps || []), { id: Date.now().toString(), step: '', expected: '' }] })}><Plus size={14} /> 단계 추가</button>
              </div>
            </div>
          ) : selectedCase ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div><h2 className="text-2xl font-bold text-gray-900">{selectedCase.title}</h2><div className="text-sm text-gray-500 mt-1">ID: {selectedCase.id}</div></div>
                {user?.role !== 'EXTERNAL' && (<button onClick={handleEditCase} className={`px-3 py-1 border rounded text-sm ${user?.role === 'INTERNAL' && selectedCase.authorId !== user.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>수정하기</button>)}
              </div>
              <div className="flex gap-4"><div className="bg-gray-100 px-3 py-1 rounded text-sm"><span className="font-semibold text-gray-600 mr-2">우선순위:</span> {selectedCase.priority}</div><div className="bg-gray-100 px-3 py-1 rounded text-sm"><span className="font-semibold text-gray-600 mr-2">유형:</span> {selectedCase.type}</div></div>
              {selectedCase.precondition && (<div><h3 className="font-semibold text-gray-700 mb-2">사전 조건</h3><div className="p-3 bg-yellow-50 border border-yellow-100 rounded text-gray-700 whitespace-pre-wrap">{selectedCase.precondition}</div></div>)}
              <div><h3 className="font-semibold text-gray-700 mb-2">테스트 절차</h3><table className="w-full border text-sm"><thead><tr className="bg-gray-50 text-left"><th className="border p-2 w-12">#</th><th className="border p-2">수행 절차</th><th className="border p-2">기대 결과</th></tr></thead><tbody>{selectedCase.steps.map((step, idx) => (<tr key={idx}><td className="border p-2 text-center text-gray-500">{idx + 1}</td><td className="border p-2 whitespace-pre-wrap">{step.step}</td><td className="border p-2 whitespace-pre-wrap">{step.expected}</td></tr>))}</tbody></table></div>
              <div className="pt-6 border-t"><h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><History size={16} /> 변경 이력</h3><div className="space-y-4">{historyLogs.map(log => (<div key={log.id} className="text-sm border-l-2 pl-3 border-gray-300"><div className="flex justify-between text-gray-500"><span><span className="font-semibold text-gray-700">{log.modifierName}</span> 님이 {log.action}</span><span>{new Date(log.timestamp).toLocaleString()}</span></div><ul className="mt-1 list-disc list-inside text-gray-600">{log.changes.map((c, i) => (<li key={i}>{c.field}: {JSON.stringify(c.oldVal)} &rarr; {JSON.stringify(c.newVal)}</li>))}</ul></div>))}</div></div>
            </div>
          ) : (<div className="h-full flex flex-col items-center justify-center text-gray-400"><FolderTree size={48} className="mb-4" /><p>상세 내용을 보려면 케이스를 선택하세요.</p></div>)}
        </div>
      </div>
      <ImportExportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} project={project} cases={cases} sections={sections} onImportSuccess={loadData} />
      <SimpleInputModal isOpen={isSectionModalOpen} onClose={() => setSectionModalOpen(false)} title="새 섹션 생성" label="이름" placeholder="예: 로그인, 결제" onSubmit={handleCreateSection} />
    </>
  );
};

// Test Runner
const TestRunner = ({ project }: { project: Project }) => {
  const { user } = useContext(AuthContext);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);
  const [casesInRun, setCasesInRun] = useState<TestCase[]>([]);
  const [sectionsInRun, setSectionsInRun] = useState<Section[]>([]);
  const [isExecutionMode, setExecutionMode] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [formActual, setFormActual] = useState('');
  const [formComment, setFormComment] = useState('');
  const [stepStatuses, setStepStatuses] = useState<Record<string, TestStatus>>({});
  const [formStatus, setFormStatus] = useState<TestStatus>('UNTESTED');
  const [formIssues, setFormIssues] = useState<Issue[]>([]);
  const [isRunModalOpen, setRunModalOpen] = useState(false);

  useEffect(() => { 
    RunService.getAll(project.id).then(setRuns); 
  }, [project]);

  useEffect(() => {
    if (activeRun) {
      Promise.all([
        TestCaseService.getCases(project.id),
        TestCaseService.getSections(project.id),
        RunService.getResults(activeRun.id)
      ]).then(([allCases, allSections, results]) => {
         const included = allCases.filter(c => activeRun.caseIds.includes(c.id));
         setCasesInRun(included);
         setRunResults(results);
         const includedSectionIds = new Set(included.map(c => c.sectionId));
         setSectionsInRun(allSections.filter(s => includedSectionIds.has(s.id)));
      });
    }
  }, [activeRun, project]);

  useEffect(() => {
    if (activeCaseId && activeRun) {
       const existingResult = runResults.find(r => r.caseId === activeCaseId);
       setFormActual(existingResult?.actualResult || '');
       setFormComment(existingResult?.comment || '');
       setFormStatus(existingResult?.status || 'UNTESTED');
       setFormIssues(existingResult?.issues || []);
       if (existingResult?.stepResults) {
         const statusMap: Record<string, TestStatus> = {};
         existingResult.stepResults.forEach(sr => { statusMap[sr.stepId] = sr.status; });
         setStepStatuses(statusMap);
       } else { setStepStatuses({}); }
    }
  }, [activeCaseId, activeRun, runResults]);

  useEffect(() => {
    const statuses = Object.values(stepStatuses);
    if (statuses.length === 0) return;
    let computed: TestStatus = 'PASS';
    if (statuses.includes('FAIL')) computed = 'FAIL';
    else if (statuses.includes('BLOCK')) computed = 'BLOCK';
    else if (statuses.includes('RETEST')) computed = 'RETEST';
    else if (statuses.every(s => s === 'NA')) computed = 'NA';
    else if (statuses.every(s => s === 'PASS')) computed = 'PASS';
    else computed = 'UNTESTED';
    setFormStatus(computed);
  }, [stepStatuses]);

  const handleCreateRun = async (title: string, caseIds: string[]) => {
    const newRun = await RunService.create({ projectId: project.id, title, status: 'OPEN', assignedToId: user?.id, caseIds: caseIds });
    setRuns([newRun, ...runs]); // Prepend logic might differ based on sort order
    RunService.getAll(project.id).then(setRuns); // Refresh to be safe
    setRunModalOpen(false);
  };

  const startExecution = (startCaseId?: string) => {
    if (!startCaseId && casesInRun.length > 0) {
      const untested = casesInRun.find(c => !runResults.some(r => r.caseId === c.id));
      setActiveCaseId(untested ? untested.id : casesInRun[0].id);
    } else if (startCaseId) { setActiveCaseId(startCaseId); }
    setExecutionMode(true);
  };

  const submitResult = async (autoNext: boolean = false, statusOverride?: TestStatus) => {
    if (!activeCaseId || !activeRun || !user) return;
    
    // Use overridden status if provided (e.g., for Pass & Next), otherwise use form state
    const statusToSave = statusOverride || formStatus;
    
    const stepResultsArray = Object.entries(stepStatuses).map(([stepId, status]) => ({ stepId, status }));
    await RunService.saveResult({
      runId: activeRun.id, 
      caseId: activeCaseId, 
      status: statusToSave, 
      actualResult: formActual, 
      comment: formComment, 
      testerId: user.id, 
      stepResults: stepResultsArray, 
      issues: formIssues.filter(i => i.label.trim() !== '')
    });
    
    const updatedResults = await RunService.getResults(activeRun.id);
    setRunResults(updatedResults);
    
    if (autoNext) {
      const currentIndex = casesInRun.findIndex(c => c.id === activeCaseId);
      if (currentIndex < casesInRun.length - 1) {
        setActiveCaseId(casesInRun[currentIndex + 1].id);
      } else {
        alert("마지막 케이스입니다.");
      }
    }
  };

  const getStatusIcon = (status?: string) => {
    switch(status) {
      case 'PASS': return <CheckCircle size={14} className="text-green-600" />;
      case 'FAIL': return <XCircle size={14} className="text-red-600" />;
      case 'BLOCK': return <MinusCircle size={14} className="text-gray-800" />;
      case 'NA': return <HelpCircle size={14} className="text-orange-500" />;
      default: return <div className="w-3.5 h-3.5 rounded-full border border-gray-300 bg-gray-50" />;
    }
  };

  const getStatusBorderColor = (status: TestStatus) => {
    switch(status) {
      case 'PASS': return 'border-green-500 bg-green-50/30';
      case 'FAIL': return 'border-red-500 bg-red-50/30';
      case 'BLOCK': return 'border-gray-800 bg-gray-50/30';
      case 'NA': return 'border-orange-400 bg-orange-50/30';
      default: return 'border-blue-200 bg-white';
    }
  };

  if (activeRun && isExecutionMode) {
      const currentCase = casesInRun.find(c => c.id === activeCaseId);
      return (
        <div className="h-full flex flex-col bg-gray-100">
           <div className="h-14 bg-white border-b flex items-center justify-between px-4">
             <div className="flex items-center gap-3"><button onClick={() => setExecutionMode(false)} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ArrowLeft size={20} /></button><div><h2 className="font-bold text-gray-800">{activeRun.title}</h2><span className="text-xs text-gray-500">실행 모드</span></div></div>
             <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-600">{casesInRun.findIndex(c => c.id === activeCaseId) + 1} / {casesInRun.length}</span></div>
           </div>
           <div className="flex-1 flex overflow-hidden">
             {/* Compact List View */}
             <div className="w-72 bg-white border-r overflow-y-auto p-2">
               {sectionsInRun.map(sec => {
                 const secCases = casesInRun.filter(c => c.sectionId === sec.id);
                 if (secCases.length === 0) return null;
                 return (
                   <div key={sec.id} className="mb-2">
                     <div className="flex items-center gap-1 font-semibold text-gray-700 mb-1 px-2 text-xs uppercase tracking-wider"><FolderTree size={12} /> {sec.title}</div>
                     <div className="space-y-0.5">
                       {secCases.map(tc => { 
                         const res = runResults.find(r => r.caseId === tc.id); 
                         const isActive = tc.id === activeCaseId; 
                         return (
                           <div key={tc.id} onClick={() => setActiveCaseId(tc.id)} className={`flex items-start gap-2 p-1.5 rounded text-xs cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50 border border-blue-200 shadow-sm' : ''}`}>
                             <div className="mt-0.5 shrink-0">{getStatusIcon(res?.status)}</div>
                             <span className={`truncate leading-snug ${isActive ? 'font-bold text-primary' : 'text-gray-600'}`}>{tc.title}</span>
                           </div>
                         ); 
                       })}
                     </div>
                   </div>
                 );
               })}
             </div>
             
             <div className="flex-1 overflow-y-auto p-8">
                {currentCase ? (
                  <div className="max-w-4xl mx-auto space-y-8 pb-20">
                     <div className="bg-white p-6 rounded shadow-sm border">
                        <div className="flex justify-between items-start mb-4">
                          <h1 className="text-xl font-bold text-gray-900 leading-tight">{currentCase.title}</h1>
                          <div className="flex gap-2 text-xs">
                             <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">Priority: {currentCase.priority}</span>
                             <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">Type: {currentCase.type}</span>
                          </div>
                        </div>
                        {currentCase.precondition && (
                          <div className="mb-6 p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                             <span className="font-bold block mb-1 text-gray-500 text-xs uppercase">Precondition</span>
                             {currentCase.precondition}
                          </div>
                        )}
                        <table className="w-full text-sm border"><thead><tr className="bg-gray-50"><th className="border p-2 w-10">#</th><th className="border p-2">절차 (Step)</th><th className="border p-2">기대 결과 (Expected)</th><th className="border p-2 w-28">Status</th></tr></thead><tbody>{currentCase.steps.map((s, i) => (<tr key={i}><td className="border p-2 text-center text-gray-500">{i+1}</td><td className="border p-2 whitespace-pre-wrap">{s.step}</td><td className="border p-2 whitespace-pre-wrap">{s.expected}</td><td className="border p-2 text-center"><select className="text-xs p-1 rounded border w-full" value={stepStatuses[s.id] || ''} onChange={(e) => setStepStatuses({...stepStatuses, [s.id]: e.target.value as TestStatus})}><option value="">-</option><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="BLOCK">BLOCKED</option><option value="NA">N/A</option></select></td></tr>))}</tbody></table>
                     </div>

                     {/* Result Container with Visual Feedback */}
                     <div className={`bg-white p-6 rounded shadow-lg border-2 relative transition-colors duration-200 ${getStatusBorderColor(formStatus)}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg">결과 저장 (Result)</h3>
                          <select 
                            className={`font-bold p-2 rounded border focus:ring-2 focus:ring-offset-1 outline-none ${
                               formStatus === 'PASS' ? 'text-green-600 border-green-200 ring-green-500' :
                               formStatus === 'FAIL' ? 'text-red-600 border-red-200 ring-red-500' :
                               formStatus === 'BLOCK' ? 'text-gray-800 border-gray-400 ring-gray-600' :
                               formStatus === 'NA' ? 'text-orange-500 border-orange-200 ring-orange-400' :
                               'text-gray-500'
                            }`} 
                            value={formStatus} 
                            onChange={(e) => setFormStatus(e.target.value as TestStatus)}
                          >
                            <option value="UNTESTED">미수행 (UNTESTED)</option>
                            <option value="PASS">PASS</option>
                            <option value="FAIL">FAIL</option>
                            <option value="BLOCK">BLOCKED</option>
                            <option value="NA">N/A</option>
                          </select>
                        </div>
                        
                        <div className="flex gap-4 mb-4">
                          <div className="flex-1">
                             <label className="block text-xs font-semibold text-gray-500 mb-1">실제 결과 (Actual Result)</label>
                             <textarea className="w-full border rounded p-2 h-24 text-sm bg-white" value={formActual} onChange={e => setFormActual(e.target.value)} placeholder="테스트 수행 후 실제 관측된 결과를 입력하세요." />
                          </div>
                          <div className="flex-1">
                             <label className="block text-xs font-semibold text-gray-500 mb-1">코멘트 (Comment)</label>
                             <textarea className="w-full border rounded p-2 h-24 text-sm bg-white" value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="추가적인 메모나 비고 사항을 입력하세요." />
                          </div>
                        </div>
                        
                        <div className="mb-6 border-t pt-4 border-gray-200">
                           <div className="flex justify-between items-center mb-2">
                             <label className="text-sm font-semibold text-red-600 flex items-center gap-1"><Bug size={14} /> 결함 (Defects)</label>
                             <button onClick={() => setFormIssues([...formIssues, {id: Date.now().toString(), label: '', url: ''}])} className="text-xs text-primary font-bold hover:underline">+ 결함 추가</button>
                           </div>
                           <div className="space-y-2">
                             {formIssues.length === 0 && <div className="text-xs text-gray-400 italic">등록된 결함이 없습니다.</div>}
                             {formIssues.map((issue, idx) => (
                               <div key={idx} className="flex gap-2 items-center bg-red-50 p-2 rounded border border-red-100">
                                 <span className="text-red-400 font-bold text-xs">#{idx+1}</span>
                                 <input 
                                   className="border rounded px-2 py-1 flex-1 text-sm focus:border-red-400 outline-none" 
                                   placeholder="이슈 제목 (예: 로그인 버튼 겹침)" 
                                   value={issue.label} 
                                   onChange={e => {const n = [...formIssues]; n[idx].label = e.target.value; setFormIssues(n)}} 
                                 />
                                 <div className="flex-1 flex items-center relative">
                                    <LinkIcon size={14} className="absolute left-2 text-gray-400"/>
                                    <input 
                                      className="border rounded pl-7 pr-2 py-1 w-full text-sm focus:border-red-400 outline-none" 
                                      placeholder="https://jira... (URL)" 
                                      value={issue.url} 
                                      onChange={e => {const n = [...formIssues]; n[idx].url = e.target.value; setFormIssues(n)}} 
                                    />
                                 </div>
                                 <button onClick={() => setFormIssues(formIssues.filter((_,i)=>i!==idx))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                               </div>
                             ))}
                           </div>
                        </div>
                        
                        <div className="flex justify-end gap-3">
                           <button onClick={() => submitResult(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-white text-gray-700 font-medium">저장 (Save)</button>
                           {/* New Pass & Next Action */}
                           <button 
                             onClick={() => submitResult(true, 'PASS')} 
                             className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-sm flex items-center gap-2"
                             title="현재 케이스를 PASS로 저장하고 다음 케이스로 이동합니다."
                           >
                             <CheckCircle size={18} /> Pass & Next
                           </button>
                        </div>
                     </div>
                  </div>
                ) : <div>케이스를 선택하세요.</div>}
             </div>
           </div>
        </div>
      );
  }

  // Run Detail Dashboard
  if (activeRun) {
    const passed = runResults.filter(r => r.status === 'PASS').length;
    const failed = runResults.filter(r => r.status === 'FAIL').length;
    const blocked = runResults.filter(r => r.status === 'BLOCK').length;
    const na = runResults.filter(r => r.status === 'NA').length;
    const untested = casesInRun.length - runResults.length;
    
    return (
      <div className="h-full flex flex-col p-6 bg-gray-50">
        <div className="flex items-center gap-4 mb-6">
           <button onClick={() => setActiveRun(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded"><ArrowLeft size={24} /></button>
           <h2 className="text-2xl font-bold text-gray-800">{activeRun.title}</h2>
           <div className="flex-1 text-right">
              <button onClick={() => startExecution()} className="bg-primary text-white px-6 py-2 rounded font-bold shadow hover:bg-blue-600 transition flex items-center gap-2 ml-auto">
                 <PlayCircle size={20} /> 테스트 시작 (Runner)
              </button>
           </div>
        </div>
        
        {/* Mini Dashboard */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6 flex items-center justify-between">
           <div className="flex gap-8 items-center">
              <div className="w-32 h-32">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'PASS', value: passed, fill: '#22c55e' },
                          { name: 'FAIL', value: failed, fill: '#ef4444' },
                          { name: 'BLOCKED', value: blocked, fill: '#1f2937' },
                          { name: 'N/A', value: na, fill: '#f97316' },
                          { name: 'UNTESTED', value: untested, fill: '#e5e7eb' }
                        ]}
                        dataKey="value"
                        innerRadius={25}
                        outerRadius={40}
                        startAngle={90}
                        endAngle={-270}
                      >
                         <Cell fill="#22c55e" />
                         <Cell fill="#ef4444" />
                         <Cell fill="#1f2937" />
                         <Cell fill="#f97316" />
                         <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                 <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Progress</div>
                 <div className="text-2xl font-bold text-gray-800">{Math.round(((casesInRun.length - untested) / casesInRun.length) * 100) || 0}%</div>
                 <div className="text-xs text-gray-400">완료됨</div>
              </div>
           </div>
           
           <div className="flex gap-4">
              <div className="text-center px-4 border-r">
                 <div className="text-2xl font-bold text-green-600">{passed}</div>
                 <div className="text-xs font-bold text-gray-500 mt-1">PASS</div>
              </div>
              <div className="text-center px-4 border-r">
                 <div className="text-2xl font-bold text-red-500">{failed}</div>
                 <div className="text-xs font-bold text-gray-500 mt-1">FAIL</div>
              </div>
              <div className="text-center px-4 border-r">
                 <div className="text-2xl font-bold text-gray-800">{blocked}</div>
                 <div className="text-xs font-bold text-gray-500 mt-1">BLOCKED</div>
              </div>
              <div className="text-center px-4 border-r">
                 <div className="text-2xl font-bold text-orange-500">{na}</div>
                 <div className="text-xs font-bold text-gray-500 mt-1">N/A</div>
              </div>
              <div className="text-center px-4">
                 <div className="text-2xl font-bold text-gray-400">{untested}</div>
                 <div className="text-xs font-bold text-gray-500 mt-1">UNTESTED</div>
              </div>
           </div>
        </div>

        <div className="flex-1 bg-white rounded shadow-sm border overflow-hidden flex flex-col">
           <div className="p-3 bg-gray-50 border-b font-semibold text-gray-700 flex justify-between items-center">
              <span>테스트 케이스 목록 ({casesInRun.length})</span>
           </div>
           <div className="flex-1 overflow-y-auto">
             <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                   <tr>
                      <th className="p-3 text-left w-24">ID</th>
                      <th className="p-3 text-left">제목</th>
                      <th className="p-3 text-center w-32">상태</th>
                      <th className="p-3 w-20"></th>
                   </tr>
                </thead>
                <tbody className="divide-y">
                   {casesInRun.map(tc => { 
                      const res = runResults.find(r => r.caseId === tc.id); 
                      let statusBadge = <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 font-medium">UNTESTED</span>;
                      if (res?.status === 'PASS') statusBadge = <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 font-bold border border-green-200">PASS</span>;
                      else if (res?.status === 'FAIL') statusBadge = <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-bold border border-red-200">FAIL</span>;
                      else if (res?.status === 'BLOCK') statusBadge = <span className="px-2 py-1 rounded text-xs bg-gray-800 text-white font-bold">BLOCKED</span>;
                      else if (res?.status === 'NA') statusBadge = <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700 font-bold border border-orange-200">N/A</span>;

                      return (
                        <tr key={tc.id} className="hover:bg-gray-50 transition-colors">
                           <td className="p-3 text-gray-500 font-mono text-xs">{tc.id.substring(0,6)}</td>
                           <td className="p-3 font-medium text-gray-800">{tc.title}</td>
                           <td className="p-3 text-center">{statusBadge}</td>
                           <td className="p-3 text-center">
                              <button onClick={() => startExecution(tc.id)} className="text-primary hover:bg-blue-50 p-1.5 rounded transition">
                                 <Play size={16} />
                              </button>
                           </td>
                        </tr>
                      ); 
                   })}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  }

  // Run List with Stacked Progress Bar
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">테스트 실행 목록</h2>{user?.role !== 'EXTERNAL' && (<button onClick={() => setRunModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16} /> 새 실행 생성</button>)}</div>
      <div className="grid gap-4">
        {runs.map(run => {
           // We need to fetch results to show progress bar, but for list view doing it individually is expensive.
           // In a real app we'd join this in the backend. 
           // For this quick port, let's fetch results here in a small component or just show generic info.
           // Better: Let's create a wrapper component for the card to fetch its own stats.
           return <RunCard key={run.id} run={run} />;
        })}
      </div>
      <RunCreationModal isOpen={isRunModalOpen} onClose={() => setRunModalOpen(false)} project={project} onSubmit={handleCreateRun} />
    </div>
  );
};

// Extracted Component to handle async stats fetching for each run card
const RunCard = ({ run }: { run: TestRun }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  
  useEffect(() => {
    RunService.getResults(run.id).then(setResults);
  }, [run.id]);

  const total = run.caseIds.length;
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const others = results.filter(r => r.status === 'BLOCK' || r.status === 'NA').length;
  const untested = total > 0 ? total - (pass + fail + others) : 0;
  
  const passPct = total > 0 ? (pass / total) * 100 : 0;
  const failPct = total > 0 ? (fail / total) * 100 : 0;
  const otherPct = total > 0 ? (others / total) * 100 : 0;

  return (
    <div className="bg-white p-5 rounded-lg shadow border hover:shadow-md transition cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              {run.title}
              {run.status === 'COMPLETED' && <CheckCircle size={16} className="text-green-500" />}
          </h3>
          <p className="text-sm text-gray-500 mt-1">생성일: {new Date(run.createdAt).toLocaleDateString()} · 총 {total}개 케이스</p>
        </div>
        <ChevronRight className="text-gray-400" />
      </div>
      
      {/* Stacked Progress Bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {pass > 0 && <div style={{width: `${passPct}%`}} className="bg-green-500 h-full" title={`Pass: ${pass}`} />}
        {fail > 0 && <div style={{width: `${failPct}%`}} className="bg-red-500 h-full" title={`Fail: ${fail}`} />}
        {others > 0 && <div style={{width: `${otherPct}%`}} className="bg-gray-800 h-full" title={`Others: ${others}`} />}
        {/* Untested uses the background color */}
      </div>
      <div className="flex justify-between mt-2 text-xs font-semibold text-gray-500">
        <span className="text-green-600">{Math.round(passPct)}% Pass</span>
        <span>{untested} Untested</span>
      </div>
    </div>
  );
};

// Admin Panel
const AdminPanel = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('INTERNAL');

  useEffect(() => {
    AuthService.getAllUsers().then(setUsers);
  }, []);

  const handleUpdate = async (updatedUser: User) => {
    await AuthService.updateUser(updatedUser);
    const refreshed = await AuthService.getAllUsers();
    setUsers(refreshed);
  };

  const handleCreate = async () => {
    if(!newUserEmail || !newUserName) return;
    const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        email: newUserEmail,
        name: newUserName,
        role: newUserRole,
        status: 'ACTIVE'
    };
    await AuthService.createUser(newUser);
    const refreshed = await AuthService.getAllUsers();
    setUsers(refreshed);
    setIsModalOpen(false);
    setNewUserEmail('');
    setNewUserName('');
  };

  if (user?.role !== 'ADMIN') return <div className="p-8 text-center text-red-500">접근 권한이 없습니다.</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">사용자 관리</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16}/> 사용자 초대</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-left">이름</th>
              <th className="p-4 text-left">이메일</th>
              <th className="p-4 text-left">권한 (Role)</th>
              <th className="p-4 text-left">상태</th>
              <th className="p-4 text-left">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4 text-gray-500">{u.email}</td>
                <td className="p-4">
                  <select 
                    className="border rounded p-1 text-sm"
                    value={u.role}
                    onChange={(e) => handleUpdate({...u, role: e.target.value as Role})}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="INTERNAL">Internal QA</option>
                    <option value="EXTERNAL">External</option>
                  </select>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="p-4">
                  {u.status === 'ACTIVE' ? (
                    <button onClick={() => handleUpdate({...u, status: 'INACTIVE'})} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                  ) : (
                    <button onClick={() => handleUpdate({...u, status: 'ACTIVE'})} className="text-green-500 hover:bg-green-50 p-1 rounded"><CheckCircle size={16}/></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       {/* Simple Modal for Create User */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="font-bold text-lg mb-4">새 사용자 초대</h3>
            <div className="space-y-3">
                <input className="w-full border p-2 rounded" placeholder="이름 (예: 홍길동)" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="이메일" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                <select className="w-full border p-2 rounded" value={newUserRole} onChange={e => setNewUserRole(e.target.value as Role)}>
                    <option value="INTERNAL">Internal QA</option>
                    <option value="EXTERNAL">External Tester</option>
                    <option value="ADMIN">Admin</option>
                </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsModalOpen(false)} className="px-3 py-1 text-gray-500">취소</button>
                <button onClick={handleCreate} className="px-3 py-1 bg-primary text-white rounded">초대하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    setUser(currentUser);
  }, []);

  // Load Projects
  useEffect(() => {
    if (user) {
        ProjectService.getAll().then(all => {
          setProjects(all);
          if (all.length > 0 && !activeProject) {
              setActiveProject(all[0]);
          }
        });
    }
  }, [user]);

  const login = async (email: string) => {
    const u = await AuthService.login(email);
    if (u) {
      setUser(u);
    } else {
      alert("사용자를 찾을 수 없습니다. (초기 데이터: admin@company.com)");
    }
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
  };

  const handleCreateProject = async (title: string, desc: string, status: ProjectStatus) => {
     const newP = await ProjectService.create({ title, description: desc, status });
     setProjects([...projects, newP]);
     setActiveProject(newP);
  };

  if (!user) return <AuthContext.Provider value={{ user, login, logout }}><LoginScreen /></AuthContext.Provider>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 text-white flex flex-col">
           <div className="p-4 border-b border-slate-700">
             <div className="text-xs text-slate-400 font-bold uppercase mb-2">Project</div>
             <div className="relative group">
                <button className="w-full text-left font-bold text-lg flex items-center justify-between">
                    <span className="truncate">{activeProject?.title || 'No Project'}</span>
                    <ChevronDown size={16} />
                </button>
                {/* Project Dropdown */}
                <div className="hidden group-hover:block absolute top-full left-0 w-full bg-white text-gray-900 shadow-xl rounded z-50 mt-1 overflow-hidden">
                    {projects.map(p => (
                        <div key={p.id} onClick={() => {setActiveProject(p); setActiveTab('DASHBOARD');}} className="p-2 hover:bg-blue-50 cursor-pointer text-sm font-medium border-b last:border-0 text-gray-900">
                            {p.title}
                        </div>
                    ))}
                    {user.role === 'ADMIN' && (
                        <div onClick={() => setProjectModalOpen(true)} className="p-2 bg-gray-50 text-primary text-center cursor-pointer text-sm font-bold hover:bg-gray-100 flex items-center justify-center gap-1">
                            <Plus size={14} /> 새 프로젝트
                        </div>
                    )}
                </div>
             </div>
           </div>

           <nav className="flex-1 p-4 space-y-2">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${activeTab === 'DASHBOARD' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                 <LayoutDashboard size={20} /> 대시보드
              </button>
              <button onClick={() => setActiveTab('CASES')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${activeTab === 'CASES' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                 <FolderTree size={20} /> 테스트 케이스
              </button>
              <button onClick={() => setActiveTab('RUNS')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${activeTab === 'RUNS' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                 <PlayCircle size={20} /> 테스트 실행
              </button>
              {user.role === 'ADMIN' && (
                  <button onClick={() => setActiveTab('ADMIN')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${activeTab === 'ADMIN' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <Users size={20} /> 사용자 관리
                  </button>
              )}
           </nav>

           <div className="p-4 border-t border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm">
                      {user.name.substring(0,1)}
                  </div>
                  <div className="overflow-hidden">
                      <div className="text-sm font-bold truncate">{user.name}</div>
                      <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  </div>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-2 text-slate-400 hover:text-white text-sm">
                 <LogOut size={16} /> 로그아웃
              </button>
           </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden bg-gray-50 flex flex-col">
            {activeProject ? (
                <>
                    {activeTab === 'DASHBOARD' && <Dashboard project={activeProject} />}
                    {activeTab === 'CASES' && <TestCaseManager project={activeProject} />}
                    {activeTab === 'RUNS' && <TestRunner project={activeProject} />}
                    {activeTab === 'ADMIN' && <AdminPanel />}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <Layout size={48} className="mb-4" />
                    <p>프로젝트를 선택하거나 생성해주세요.</p>
                    {user.role === 'ADMIN' && (
                        <button onClick={() => setProjectModalOpen(true)} className="mt-4 px-4 py-2 bg-primary text-white rounded font-bold">프로젝트 생성</button>
                    )}
                </div>
            )}
        </div>
      </div>
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => setProjectModalOpen(false)} onSubmit={handleCreateProject} />
    </AuthContext.Provider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);