import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Layout, LayoutDashboard, FolderTree, PlayCircle, Settings, Users, LogOut, 
  Plus, ChevronRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Clock, Save, History, Search, Filter,
  Download, Upload, FileText, AlertTriangle, ArrowRightLeft, ArrowRight, CheckSquare, Square,
  Play, PauseCircle, SkipForward, ArrowLeft, MoreVertical, Edit, Archive, Folder, Grid, List, Trash2, Bug, ExternalLink, BarChart2,
  Table
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
  login: (email: string) => void;
  logout: () => void;
}>({ user: null, login: () => {}, logout: () => {} });

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(email);
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
          <button type="submit" className="w-full bg-primary text-white py-2 rounded hover:bg-blue-700">로그인</button>
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
            onClick={() => {
              if(title.trim()) { onSubmit(title, desc, status); onClose(); }
            }} 
            className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50 font-bold"
            disabled={!title.trim()}
          >
            {initialData ? '수정 완료' : '프로젝트 생성'}
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

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setMode('ALL');
      const s = TestCaseService.getSections(project.id);
      const c = TestCaseService.getCases(project.id);
      setSections(s);
      setAllCases(c);
      setSelectedCaseIds(new Set(c.map(tc => tc.id)));
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

  const handleSubmit = () => {
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
    onSubmit(title, finalIds);
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
          {mode === 'CUSTOM' && (
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
          <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 shadow-sm">실행 계획 생성</button>
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
      const allRuns = RunService.getAll(project.id);
      setRuns(allRuns);
      setSelectedRunId('');
      setReportData(null);
    }
  }, [isOpen, project]);

  useEffect(() => {
    if (selectedRunId) {
      const run = runs.find(r => r.id === selectedRunId);
      if (run) {
        const results = RunService.getResults(run.id);
        const pass = results.filter(r => r.status === 'PASS').length;
        const fail = results.filter(r => r.status === 'FAIL').length;
        const untested = (run.caseIds?.length || 0) - results.length;
        
        const allDefects: { issue: Issue, caseTitle: string }[] = [];
        const cases = TestCaseService.getCases(project.id);
        const caseMap = new Map(cases.map(c => [c.id, c.title]));

        results.forEach(res => {
          if (res.issues && res.issues.length > 0) {
            res.issues.forEach(issue => {
              allDefects.push({ issue, caseTitle: caseMap.get(res.caseId) || 'Unknown Case' });
            });
          }
        });
        setReportData({ run, results, pass, fail, untested, allDefects });
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
    const cases = TestCaseService.getCases(project.id);
    const runs = RunService.getAll(project.id);
    setStats({
      total: cases.length,
      automated: 0,
      runs: runs.length,
      passRate: 75 
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

  const finalizeImport = () => {
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
    (TestCaseService as any).importCases(project.id, newCases, user);
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
             <button onClick={finalizeImport} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 font-bold flex items-center gap-2"><Download size={16} /> 가져오기 완료</button>
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

  useEffect(() => { loadData(); }, [project]);

  const loadData = () => {
    setSections(TestCaseService.getSections(project.id));
    setCases(TestCaseService.getCases(project.id));
  };

  const handleCreateSection = (name: string) => {
    TestCaseService.createSection({ projectId: project.id, title: name });
    loadData();
    setSectionModalOpen(false);
  };

  const handleSelectCase = (tc: TestCase) => {
    setSelectedCase(tc);
    setIsEditing(false);
    setHistoryLogs(HistoryService.getLogs(tc.id));
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

  const handleSave = () => {
    if (!formData.title || !user) return;
    const saved = TestCaseService.saveCase(formData, user);
    setIsEditing(false);
    setSelectedCase(saved);
    loadData();
    setHistoryLogs(HistoryService.getLogs(saved.id));
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
            <h3 className="font-semibold text-gray-700">{filteredCases.length}개의 케이스</h3>
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

  useEffect(() => { setRuns(RunService.getAll(project.id)); }, [project]);

  useEffect(() => {
    if (activeRun) {
      const allCases = TestCaseService.getCases(project.id);
      const allSections = TestCaseService.getSections(project.id);
      const included = allCases.filter(c => activeRun.caseIds.includes(c.id));
      setCasesInRun(included);
      setRunResults(RunService.getResults(activeRun.id));
      const includedSectionIds = new Set(included.map(c => c.sectionId));
      setSectionsInRun(allSections.filter(s => includedSectionIds.has(s.id)));
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

  const handleCreateRun = (title: string, caseIds: string[]) => {
    const newRun = RunService.create({ projectId: project.id, title, status: 'OPEN', assignedToId: user?.id, caseIds: caseIds });
    setRuns([...runs, newRun]);
    setRunModalOpen(false);
  };

  const startExecution = (startCaseId?: string) => {
    if (!startCaseId && casesInRun.length > 0) {
      const untested = casesInRun.find(c => !runResults.some(r => r.caseId === c.id));
      setActiveCaseId(untested ? untested.id : casesInRun[0].id);
    } else if (startCaseId) { setActiveCaseId(startCaseId); }
    setExecutionMode(true);
  };

  const submitResult = (autoNext: boolean = false) => {
    if (!activeCaseId || !activeRun || !user) return;
    const stepResultsArray = Object.entries(stepStatuses).map(([stepId, status]) => ({ stepId, status }));
    RunService.saveResult({
      runId: activeRun.id, caseId: activeCaseId, status: formStatus, actualResult: formActual, comment: formComment, testerId: user.id, stepResults: stepResultsArray, issues: formIssues.filter(i => i.label.trim() !== '')
    });
    setRunResults(RunService.getResults(activeRun.id));
    if (autoNext) {
      const currentIndex = casesInRun.findIndex(c => c.id === activeCaseId);
      if (currentIndex < casesInRun.length - 1) setActiveCaseId(casesInRun[currentIndex + 1].id);
      else alert("마지막 케이스입니다.");
    }
  };

  const getStatusIcon = (status?: string) => {
    switch(status) {
      case 'PASS': return <CheckCircle size={16} className="text-green-600" />;
      case 'FAIL': return <XCircle size={16} className="text-red-600" />;
      case 'BLOCK': return <AlertCircle size={16} className="text-gray-800" />;
      default: return <div className="w-4 h-4 rounded-full border border-gray-300 bg-gray-50" />;
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
             <div className="w-80 bg-white border-r overflow-y-auto p-4">
               {sectionsInRun.map(sec => {
                 const secCases = casesInRun.filter(c => c.sectionId === sec.id);
                 if (secCases.length === 0) return null;
                 return (
                   <div key={sec.id} className="mb-4"><div className="flex items-center gap-1 font-semibold text-gray-700 mb-1"><FolderTree size={14} /> {sec.title}</div><div className="pl-2 border-l-2 border-gray-100 space-y-1">{secCases.map(tc => { const res = runResults.find(r => r.caseId === tc.id); const isActive = tc.id === activeCaseId; return (<div key={tc.id} onClick={() => setActiveCaseId(tc.id)} className={`flex items-start gap-2 p-2 rounded text-sm cursor-pointer hover:bg-gray-50 ${isActive ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : ''}`}><div className="mt-0.5">{getStatusIcon(res?.status)}</div><span className={`truncate ${isActive ? 'font-semibold text-primary' : 'text-gray-600'}`}>{tc.title}</span></div>); })}</div></div>
                 );
               })}
             </div>
             <div className="flex-1 overflow-y-auto p-8">
                {currentCase ? (
                  <div className="max-w-4xl mx-auto space-y-8">
                     <div className="bg-white p-6 rounded shadow-sm border">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">{currentCase.title}</h1>
                        <table className="w-full text-sm border"><thead><tr className="bg-gray-50"><th className="border p-2">#</th><th className="border p-2">절차</th><th className="border p-2">기대 결과</th><th className="border p-2 w-28">Status</th></tr></thead><tbody>{currentCase.steps.map((s, i) => (<tr key={i}><td className="border p-2 text-center">{i+1}</td><td className="border p-2">{s.step}</td><td className="border p-2">{s.expected}</td><td className="border p-2 text-center"><select className="text-xs p-1 rounded border" value={stepStatuses[s.id] || ''} onChange={(e) => setStepStatuses({...stepStatuses, [s.id]: e.target.value as TestStatus})}><option value="">(선택)</option><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="BLOCK">BLOCK</option><option value="NA">N/A</option></select></td></tr>))}</tbody></table>
                     </div>
                     <div className="bg-white p-6 rounded shadow-lg border-2 relative border-blue-100">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">결과 저장</h3><select className="font-bold p-2 rounded border" value={formStatus} onChange={(e) => setFormStatus(e.target.value as TestStatus)}><option value="UNTESTED">미수행</option><option value="PASS">성공</option><option value="FAIL">실패</option><option value="BLOCK">차단됨</option><option value="NA">해당없음</option></select></div>
                        <div className="flex gap-4 mb-4"><textarea className="flex-1 border rounded p-2 h-24" value={formActual} onChange={e => setFormActual(e.target.value)} placeholder="실제 결과" /><textarea className="flex-1 border rounded p-2 h-24" value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="코멘트" /></div>
                        <div className="mb-4 border-t pt-4"><div className="flex justify-between items-center mb-2"><label className="text-sm font-semibold text-red-600 flex items-center gap-1"><Bug size={14} /> 결함</label><button onClick={() => setFormIssues([...formIssues, {id: Date.now().toString(), label: '', url: ''}])} className="text-xs text-primary font-bold">+ 추가</button></div><div className="space-y-3">{formIssues.map((issue, idx) => (<div key={idx} className="flex gap-2"><input className="border rounded px-2 py-1 flex-1 text-sm" placeholder="이슈 내용" value={issue.label} onChange={e => {const n = [...formIssues]; n[idx].label = e.target.value; setFormIssues(n)}} /><button onClick={() => setFormIssues(formIssues.filter((_,i)=>i!==idx))} className="text-red-500"><Trash2 size={16}/></button></div>))}</div></div>
                        <div className="flex justify-end gap-3"><button onClick={() => submitResult(false)} className="px-4 py-2 border rounded">저장</button><button onClick={() => submitResult(true)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">저장 & 다음</button></div>
                     </div>
                  </div>
                ) : <div>케이스를 선택하세요.</div>}
             </div>
           </div>
        </div>
      );
  }

  if (activeRun) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveRun(null)} className="text-gray-500">&larr;</button><h2 className="text-2xl font-bold">{activeRun.title}</h2><div className="flex-1 text-right"><button onClick={() => startExecution()} className="bg-primary text-white px-6 py-2 rounded font-bold shadow">테스트 시작</button></div></div>
        <div className="flex-1 bg-white rounded shadow overflow-y-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">제목</th><th className="p-3 text-left">상태</th><th className="p-3"></th></tr></thead><tbody>{casesInRun.map(tc => { const res = runResults.find(r => r.caseId === tc.id); return (<tr key={tc.id} className="hover:bg-gray-50"><td className="p-3 text-gray-500">{tc.id.substring(0,6)}</td><td className="p-3 font-medium">{tc.title}</td><td className="p-3">{res?.status || 'UNTESTED'}</td><td className="p-3 text-center"><button onClick={() => startExecution(tc.id)} className="text-primary text-sm">실행</button></td></tr>); })}</tbody></table></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">테스트 실행 목록</h2>{user?.role !== 'EXTERNAL' && (<button onClick={() => setRunModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16} /> 새 실행 생성</button>)}</div>
      <div className="grid gap-4">{runs.map(run => (<div key={run.id} className="bg-white p-4 rounded shadow flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={() => setActiveRun(run)}><div><h3 className="font-bold text-lg">{run.title}</h3><p className="text-sm text-gray-500">생성일: {new Date(run.createdAt).toLocaleDateString()}</p></div><ChevronRight className="text-gray-400" /></div>))}</div>
      <RunCreationModal isOpen={isRunModalOpen} onClose={() => setRunModalOpen(false)} project={project} onSubmit={handleCreateRun} />
    </div>
  );
};

// Admin Panel
const AdminPanel = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => { setUsers(AuthService.getAllUsers()); }, []);

  const toggleStatus = (targetUser: User) => {
    const newStatus = targetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    AuthService.updateUser({ ...targetUser, status: newStatus });
    setUsers(AuthService.getAllUsers());
  };

  const changeRole = (targetUser: User, newRole: Role) => {
    AuthService.updateUser({ ...targetUser, role: newRole });
    setUsers(AuthService.getAllUsers());
  };

  if (user?.role !== 'ADMIN') return <div>접근 권한이 없습니다.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">사용자 관리</h2>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
           <thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">이름</th><th className="p-3 text-left">이메일</th><th className="p-3 text-left">역할</th><th className="p-3 text-left">상태</th><th className="p-3 text-left">작업</th></tr></thead>
           <tbody className="divide-y">{users.map(u => (<tr key={u.id}><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-gray-500">{u.email}</td><td className="p-3"><select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)} className="border rounded p-1 text-sm" disabled={u.id === user.id}><option value="ADMIN">관리자</option><option value="INTERNAL">내부 QA</option><option value="EXTERNAL">외부 인원</option></select></td><td className="p-3">{u.status}</td><td className="p-3">{u.id !== user.id && (<button onClick={() => toggleStatus(u)} className="text-sm text-red-600 hover:underline">{u.status === 'ACTIVE' ? '차단' : '복구'}</button>)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

// Directory View
const DirectoryExplorer = ({ 
  projects, onManageProjects, onOpenProject
}: { 
  projects: Project[], onManageProjects: () => void, onOpenProject: (p: Project) => void
}) => {
  return (
    <div className="p-8 h-full bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-900"><Folder size={20} className="fill-current text-blue-500"/> Home</div>
        <button onClick={onManageProjects} className="bg-primary text-white px-4 py-2 rounded shadow hover:bg-blue-600 flex items-center gap-2"><Plus size={16} /> 새 프로젝트</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
         {projects.map(p => (<div key={p.id} onClick={() => onOpenProject(p)} className={`bg-white p-5 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between h-40 ${p.status === 'ARCHIVED' ? 'opacity-60 bg-gray-100' : ''}`}><div><div className="flex items-start justify-between mb-2"><Folder size={32} className={`text-blue-500 fill-current ${p.status === 'ARCHIVED' ? 'text-gray-400' : ''}`} />{p.status === 'ARCHIVED' && <Archive size={16} className="text-gray-500"/>}</div><h3 className="font-bold text-gray-800 truncate" title={p.title}>{p.title}</h3><p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || '설명 없음'}</p></div><div className="text-xs text-gray-400 mt-2 flex justify-between items-end"><span>{new Date(p.createdAt).toLocaleDateString()}</span></div></div>))}
      </div>
    </div>
  );
};

// Main App
const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'CASES' | 'RUNS' | 'ADMIN' | 'DIRECTORY'>('DASHBOARD');
  const [isProjectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  useEffect(() => {
    const loggedIn = AuthService.getCurrentUser();
    if (loggedIn) setUser(loggedIn);
    refreshProjects();
  }, []);

  const refreshProjects = () => {
    const projs = ProjectService.getAll();
    setAllProjects(projs);
    if (!activeProject && projs.length > 0) setActiveProject(projs[0]);
  };

  const login = (email: string) => {
    const u = AuthService.login(email);
    if (u) { setUser(u); refreshProjects(); } else alert("사용자를 찾을 수 없습니다.");
  };

  const logout = () => { AuthService.logout(); setUser(null); };

  const handleCreateProject = (title: string, desc: string, status: ProjectStatus) => {
    ProjectService.create({ title, description: desc, status });
    refreshProjects();
    setProjectModalOpen(false);
  };

  const handleUpdateProject = (title: string, desc: string, status: ProjectStatus) => {
    if (editingProject) {
      ProjectService.update({ ...editingProject, title, description: desc, status });
      refreshProjects();
      if (activeProject?.id === editingProject.id) { setActiveProject({ ...editingProject, title, description: desc, status }); }
      setProjectModalOpen(false);
      setEditingProject(undefined);
    }
  };

  if (!user) return <AuthContext.Provider value={{ user, login, logout }}><LoginScreen /></AuthContext.Provider>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="flex h-screen bg-gray-50">
        <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col relative z-20">
          <div className="border-b border-slate-800 relative">
             <button onClick={() => setProjectSwitcherOpen(!isProjectSwitcherOpen)} className="w-full p-4 flex items-center justify-between hover:bg-slate-800 transition"><div className="flex flex-col items-start overflow-hidden"><div className="text-xs text-blue-500 font-bold uppercase mb-0.5">Project</div><div className="font-bold text-white text-sm truncate w-full text-left">{activeProject ? activeProject.title : 'No Project'}</div></div><ChevronDown size={16} /></button>
             {isProjectSwitcherOpen && (<div className="absolute top-full left-0 w-64 bg-slate-800 shadow-xl border-t border-slate-700 flex flex-col z-30"><div className="max-h-60 overflow-y-auto">{allProjects.filter(p => p.status === 'ACTIVE').map(p => (<button key={p.id} onClick={() => {setActiveProject(p); setProjectSwitcherOpen(false); setCurrentView('DASHBOARD');}} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-700 border-b border-slate-700/50 flex items-center justify-between ${activeProject?.id === p.id ? 'bg-slate-700/50 text-white font-semibold' : ''}`}><span className="truncate">{p.title}</span></button>))}</div><button onClick={() => {setCurrentView('DIRECTORY'); setProjectSwitcherOpen(false);}} className="w-full text-left px-4 py-3 text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-slate-700 flex items-center gap-2"><Folder size={16} /> 모든 프로젝트 보기</button></div>)}
          </div>
          <nav className="flex-1 p-2 space-y-1 mt-2">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Layout size={18} /> 대시보드</button>
            <button onClick={() => setCurrentView('CASES')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'CASES' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><FolderTree size={18} /> 테스트 케이스</button>
            <button onClick={() => setCurrentView('RUNS')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'RUNS' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><PlayCircle size={18} /> 테스트 실행</button>
            {user.role === 'ADMIN' && (<button onClick={() => setCurrentView('ADMIN')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'ADMIN' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Users size={18} /> 사용자 관리</button>)}
          </nav>
          <div className="p-4 border-t border-slate-800"><button onClick={logout} className="w-full flex items-center gap-2 text-sm text-slate-400 hover:text-white"><LogOut size={16} /> 로그아웃</button></div>
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 bg-white border-b flex items-center px-6 justify-between"><div className="flex items-center gap-2 text-gray-500">{currentView === 'DIRECTORY' ? <span className="font-semibold text-gray-900 flex items-center gap-2"><Folder size={18}/> 프로젝트 디렉토리</span> : <span>{activeProject?.title}</span>}</div>{activeProject && currentView !== 'DIRECTORY' && user.role === 'ADMIN' && (<button onClick={() => { setEditingProject(activeProject); setProjectModalOpen(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Settings size={18} /></button>)}</header>
          <div className="flex-1 overflow-auto bg-gray-50">
             {currentView === 'DIRECTORY' ? (<DirectoryExplorer projects={allProjects} onManageProjects={() => { setEditingProject(undefined); setProjectModalOpen(true); }} onOpenProject={(p) => { setActiveProject(p); setCurrentView('DASHBOARD'); }} />) : !activeProject ? (<div className="h-full flex flex-col items-center justify-center text-gray-400">선택된 프로젝트가 없습니다.</div>) : (
               <>
                 {currentView === 'DASHBOARD' && <Dashboard project={activeProject} />}
                 {currentView === 'CASES' && <TestCaseManager project={activeProject} />}
                 {currentView === 'RUNS' && <TestRunner project={activeProject} />}
                 {currentView === 'ADMIN' && <AdminPanel />}
               </>
             )}
          </div>
        </main>
      </div>
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => { setProjectModalOpen(false); setEditingProject(undefined); }} onSubmit={editingProject ? handleUpdateProject : handleCreateProject} initialData={editingProject} />
    </AuthContext.Provider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);