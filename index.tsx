import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Layout, LayoutDashboard, FolderTree, PlayCircle, Settings, Users, LogOut, AlertOctagon, ChevronLeft,
  Plus, ChevronRight, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Clock, Save, History, Search, Filter,
  Download, Upload, FileText, AlertTriangle, ArrowRightLeft, ArrowRight, CheckSquare, Square,
  Play, PauseCircle, SkipForward, ArrowLeft, MoreVertical, Edit, Archive, Folder, Grid, List, Trash2, Bug, ExternalLink, BarChart2,
  Table, Link as LinkIcon, MinusCircle, HelpCircle, LayoutGrid, RotateCcw, Loader2
} from 'lucide-react';
import { 
  AuthService, ProjectService, TestCaseService, RunService, HistoryService, 
  DashboardService,
} from './storage';
import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, TestStep, Role, TestStatus, ProjectStatus, Issue, ExecutionHistoryItem
} from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// --- Contexts ---

const AuthContext = createContext<{
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  users: User[];
}>({ user: null, login: async () => {}, logout: () => {}, users: [] });

// 1. 공용 스피너 (리스트/상세 화면용)
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 animate-in fade-in duration-300">
    <Loader2 size={40} className="animate-spin mb-4 text-primary opacity-50" />
    <p className="text-sm font-medium">데이터를 불러오는 중입니다...</p>
  </div>
);

// 2. 대시보드 전용 스켈레톤 (뼈대 UI)
const DashboardSkeleton = () => (
  <div className="p-6 space-y-6 animate-pulse">
    <div className="flex justify-between items-center mb-6">
      <div className="h-8 w-64 bg-gray-200 rounded"></div>
      <div className="h-10 w-32 bg-gray-200 rounded"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-200 h-32 rounded shadow"></div>
      ))}
    </div>
    <div className="bg-gray-200 h-96 rounded shadow mt-6"></div>
  </div>
);

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

// Format text with numbered list line breaks
const formatTextWithNumbers = (text: string) => {
  if (!text) return '';
  return text.replace(/([^\n])(\d+\.)/g, '$1\n$2');
};

// --- Components ---

const StepDiffViewer = ({ oldSteps, newSteps }: { oldSteps: TestStep[], newSteps: TestStep[] }) => {
  const maxLen = Math.max(oldSteps?.length || 0, newSteps?.length || 0);
  const rows = [];

  for (let i = 0; i < maxLen; i++) {
    const o = oldSteps?.[i];
    const n = newSteps?.[i];
    
    if (!o && n) {
      // Added
      rows.push(
        <div key={i} className="bg-green-50 border-l-4 border-green-400 p-2 mb-2 text-xs">
          <div className="font-bold text-green-700">Step {i + 1} (Added)</div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div><span className="font-semibold">Act:</span> {n.step}</div>
            <div><span className="font-semibold">Exp:</span> {n.expected}</div>
          </div>
        </div>
      );
    } else if (o && !n) {
      // Removed
      rows.push(
        <div key={i} className="bg-red-50 border-l-4 border-red-400 p-2 mb-2 text-xs opacity-70">
          <div className="font-bold text-red-700">Step {i + 1} (Removed)</div>
          <div className="grid grid-cols-2 gap-2 mt-1 line-through text-gray-500">
             <div>{o.step}</div><div>{o.expected}</div>
          </div>
        </div>
      );
    } else if (JSON.stringify(o) !== JSON.stringify(n)) {
      // Modified
      rows.push(
        <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2 text-xs">
          <div className="font-bold text-yellow-700">Step {i + 1} (Modified)</div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="space-y-1">
               <div className="text-red-500 line-through bg-red-100/50 p-0.5">{o?.step}</div>
               <div className="text-green-600 bg-green-100/50 p-0.5">{n?.step}</div>
            </div>
            <div className="space-y-1">
               <div className="text-red-500 line-through bg-red-100/50 p-0.5">{o?.expected}</div>
               <div className="text-green-600 bg-green-100/50 p-0.5">{n?.expected}</div>
            </div>
          </div>
        </div>
      );
    }
  }
  
  if (rows.length === 0) return <div className="text-gray-400 text-xs italic">No changes in steps</div>;
  return <div>{rows}</div>;
};

const HistoryModal = ({ isOpen, onClose, logs }: { isOpen: boolean, onClose: () => void, logs: HistoryLog[] }) => {
  const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);

  useEffect(() => {
    if (isOpen && logs.length > 0) setSelectedLog(logs[0]);
  }, [isOpen, logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg shadow-xl w-[900px] h-[70vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-bold text-lg flex items-center gap-2"><History size={20}/> 변경 이력 (History Timeline)</h3>
          <button onClick={onClose}><XCircle size={20} /></button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline List */}
          <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
             {logs.length === 0 && <div className="p-4 text-gray-500 text-center text-sm">변경 이력이 없습니다.</div>}
             {logs.map((log, idx) => (
               <div 
                 key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 className={`p-4 border-b cursor-pointer transition ${selectedLog?.id === log.id ? 'bg-white border-l-4 border-l-primary shadow-sm' : 'hover:bg-gray-100'}`}
               >
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{log.modifierName.charAt(0)}</div>
                   <div>
                     <div className="text-sm font-bold text-gray-800">{log.modifierName}</div>
                     <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</div>
                   </div>
                 </div>
                 <div className="mt-2 text-xs font-semibold text-gray-600">
                   {log.action === 'CREATE' ? 'Created Case' : 
                    log.changes.length > 0 ? `${log.changes.length} fields changed` : 'Updated'}
                 </div>
               </div>
             ))}
          </div>
          {/* Diff View */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {selectedLog ? (
               <div className="space-y-6">
                 <div className="flex justify-between items-center border-b pb-4">
                    <h4 className="font-bold text-xl">{selectedLog.action}</h4>
                    <span className="text-sm text-gray-500">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                 </div>
                 {selectedLog.changes.map((change, idx) => (
                   <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="font-bold text-sm text-gray-700 uppercase mb-3 border-b border-gray-200 pb-1">{change.field}</div>
                      
                      {change.field === 'steps' ? (
                        <StepDiffViewer oldSteps={change.oldVal || []} newSteps={change.newVal || []} />
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <div className="bg-red-50 p-2 rounded border border-red-100">
                             <div className="text-xs font-bold text-red-400 mb-1">BEFORE</div>
                             <div className="text-red-900 whitespace-pre-wrap break-words">{String(change.oldVal || '(Empty)')}</div>
                           </div>
                           <div className="bg-green-50 p-2 rounded border border-green-100">
                             <div className="text-xs font-bold text-green-400 mb-1">AFTER</div>
                             <div className="text-green-900 whitespace-pre-wrap break-words">{String(change.newVal || '(Empty)')}</div>
                           </div>
                        </div>
                      )}
                   </div>
                 ))}
                 {selectedLog.changes.length === 0 && selectedLog.action === 'CREATE' && (
                   <div className="text-center py-10 text-gray-400">
                     초기 생성 버전입니다.
                   </div>
                 )}
               </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                좌측 목록에서 이력을 선택하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative z-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">TestJail</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <input 
              type="email" 
              className="mt-1 block w-full p-2 border rounded" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="이메일을 입력해 주세요"
            />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-primary text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
};

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
              placeholder="예: TF2000 3월 정기배포"
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

const ProjectList = ({ 
  projects, onSelect, onCreate, onEdit, onDelete 
}: { 
  projects: Project[], 
  onSelect: (p: Project) => void, 
  onCreate: () => void,
  onEdit: (p: Project) => void,    // [추가]
  onDelete: (id: string) => void   // [추가]
}) => {
  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
       <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">전체 프로젝트</h1>
            <p className="text-gray-500 mt-1">관리 중인 모든 품질 보증 프로젝트 목록입니다.</p>
          </div>
          <button onClick={onCreate} className="px-4 py-2 bg-primary text-white rounded-lg font-bold shadow hover:bg-blue-600 flex items-center gap-2">
            <Plus size={20}/> 새 프로젝트
          </button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(p => {
            const isArchived = p.status === 'ARCHIVED';
            return (
              <div 
                key={p.id} 
                onClick={() => onSelect(p)} 
                className={`rounded-xl shadow-sm border p-6 flex flex-col h-52 transition group relative
                  ${isArchived ? 'bg-gray-50 border-gray-200' : 'bg-white hover:border-primary hover:shadow-md cursor-pointer'}
                `}
              >
                 <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${isArchived ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-primary'}`}>
                      {isArchived ? <Archive size={24} /> : <Folder size={24} />}
                    </div>
                    
                    {/* [추가] 수정/삭제 버튼 그룹 (우측 상단) */}
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                       <button 
                         onClick={() => onEdit(p)}
                         className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded transition"
                         title="수정 / 상태 변경"
                       >
                         <Edit size={16} />
                       </button>
                       <button 
                         onClick={() => onDelete(p.id)}
                         className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded transition"
                         title="프로젝트 삭제"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 mb-2">
                    <h3 className={`font-bold text-xl truncate ${isArchived ? 'text-gray-500' : 'text-gray-900 group-hover:text-primary'}`}>
                      {p.title}
                    </h3>
                    {isArchived && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">Archived</span>}
                 </div>
                 
                 <p className="text-sm text-gray-500 line-clamp-2 flex-1">{p.description || '설명이 없습니다.'}</p>
                 
                 <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex justify-between items-center">
                    <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                    {!isArchived && <ArrowRight size={16} className="text-gray-300 group-hover:text-primary transition-colors" />}
                 </div>
              </div>
            );
          })}
          
          {/* Create Placeholder */}
          <div onClick={onCreate} className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-blue-50 cursor-pointer transition h-52">
             <Plus size={32} className="mb-2"/>
             <span className="font-bold">새 프로젝트 생성</span>
          </div>
       </div>
    </div>
  )
}

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

const Dashboard = ({ project }: { project: Project }) => {
  const [stats, setStats] = useState({ total: 0, activeRuns: 0, passRate: 0, defects: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true); // [추가] 로딩 상태

  useEffect(() => {
    setLoading(true); // 로딩 시작
    setStats({ total: 0, activeRuns: 0, passRate: 0, defects: 0 });
    setChartData([]);

    DashboardService.getStats(project.id).then(data => {
      setStats({
        total: data.totalCases,
        activeRuns: data.activeRuns,
        passRate: data.passRate,
        defects: data.defectCount
      });
      setChartData(data.chartData);
      setLoading(false); // 로딩 완료
    });
  }, [project]);

  // [추가] 로딩 중이면 스켈레톤 리턴
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-gray-800">대시보드: {project.title}</h2>
         <button onClick={() => setReportModalOpen(true)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded shadow-sm hover:bg-gray-50 flex items-center gap-2">
           <BarChart2 size={18} /> 보고서 생성
         </button>
      </div>
      
      {/* KPI 카드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-bold uppercase">총 테스트 케이스</h3>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-indigo-500">
          <h3 className="text-gray-500 text-sm font-bold uppercase">진행 중인 실행 (Active Runs)</h3>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.activeRuns}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-bold uppercase">평균 통과율</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.passRate}%</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm font-bold uppercase">발견된 결함 (Defects)</h3>
          <p className="text-3xl font-bold text-red-500 mt-1">{stats.defects}</p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="bg-white p-6 rounded shadow h-96">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart2 size={20} className="text-gray-400"/> 최근 7일간 활동 추이
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 30, left: 0, bottom: 40 }} // [유지] 아래쪽 여백 넉넉하게
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ dy: 10 }} // [유지] 날짜 위치 조정
              />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                wrapperStyle={{ paddingTop: '20px' }} // [유지] 범례 위쪽 간격
              />
              
              <Bar name="성공(Passed)" dataKey="passed" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar name="실패(Failed)" dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            데이터를 불러오는 중이거나 활동 내역이 없습니다.
          </div>
        )}
      </div>
      
      <ReportModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} project={project} />
    </div>
  );
};

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
      
      let bestIndex = 0;
      let bestScore = -1;
      const SCAN_LIMIT = Math.min(rows.length, 20);
      const KEYWORDS = ['title', '제목', 'section', '섹션', 'folder', '폴더', 'priority', '우선순위', '중요도', 'type', '유형', 'step', '단계', '절차', 'expected', '기대', '결과'];

      for (let i = 0; i < SCAN_LIMIT; i++) {
        const row = rows[i];
        if (!row.some(c => c && c.trim() !== '')) continue;

        let score = 0;
        row.forEach(cell => {
          if (cell && typeof cell === 'string') {
            const val = cell.toLowerCase().trim();
            if (KEYWORDS.some(k => val.includes(k))) score++;
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      
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

  const getPreviewRow = () => {
    if (csvMatrix.length <= headerRowIndex + 1) return null;
    
    const titleIdx = mapping['title'];
    if (titleIdx !== undefined) {
      for (let i = headerRowIndex + 1; i < Math.min(csvMatrix.length, headerRowIndex + 6); i++) {
        if (csvMatrix[i][titleIdx] && csvMatrix[i][titleIdx].trim() !== '') {
          return csvMatrix[i];
        }
      }
    }

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

const TestCaseManager = ({ project }: { project: Project }) => {
  const { user, users } = useContext(AuthContext);
  const [sections, setSections] = useState<Section[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [isSectionModalOpen, setSectionModalOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [caseHistory, setCaseHistory] = useState<HistoryLog[]>([]);

  const [editForm, setEditForm] = useState<Partial<TestCase>>({});
  
  // [추가] 로딩 상태
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true); // 로딩 시작
    Promise.all([
      TestCaseService.getSections(project.id),
      TestCaseService.getCases(project.id)
    ]).then(([s, c]) => {
      setSections(s);
      setCases(c);
      setLoading(false); // 로딩 끝
    });
  };

  useEffect(() => {
    loadData();
    setSelectedSectionId(null);
    setSelectedCase(null);
    setIsEditing(false);
  }, [project]);

  useEffect(() => {
    if (selectedCase && isHistoryOpen) {
      HistoryService.getLogs(selectedCase.id).then(setCaseHistory);
    }
  }, [isHistoryOpen, selectedCase]);

  const filteredCases = selectedSectionId 
    ? cases.filter(c => c.sectionId === selectedSectionId)
    : cases;

  const handleCreateCase = () => {
    const newCase: Partial<TestCase> = {
      title: '',
      sectionId: selectedSectionId || (sections[0]?.id),
      projectId: project.id,
      priority: 'MEDIUM',
      type: 'FUNCTIONAL',
      steps: [{ id: '1', step: '', expected: '' }]
    };
    setEditForm(newCase);
    setSelectedCase(null);
    setIsEditing(true);
  };

  const handleSaveCase = async () => {
    if (!editForm.title || !user) return;
    const saved = await TestCaseService.saveCase(editForm, user);
    setIsEditing(false);
    loadData();
    setSelectedCase(saved); 
  };
  
  // [3-2, 3-3] 테스트 케이스 삭제: 컨펌 팝업 없이 즉시 삭제 (이전 턴 반영)
  const handleDeleteCase = async (caseId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    await TestCaseService.deleteCase(caseId);
    loadData();
    if (selectedCase?.id === caseId) {
      setSelectedCase(null);
      setIsEditing(false);
    }
  };

  // [3-1] 섹션 삭제: 하위 케이스 존재 시 컨펌 (이전 턴 반영)
  const handleDeleteSection = async (sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault(); 

    const sectionCases = cases.filter(c => c.sectionId === sectionId);
    const count = sectionCases.length;
    
    if (count > 0) {
      const isConfirmed = window.confirm(`해당 폴더 삭제 시, 하위 ${count}개의 테스트케이스가 삭제됩니다. 삭제하시겠습니까?`);
      if (!isConfirmed) return; 
    }
    
    await TestCaseService.deleteSection(sectionId);
    loadData();
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="flex h-full bg-white rounded shadow overflow-hidden">
      {/* 1. 왼쪽 섹션 패널 */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        <div className="p-3 border-b flex justify-between items-center">
          <span className="font-bold text-gray-700 text-sm">섹션 (Folders)</span>
          <button onClick={() => setSectionModalOpen(true)} className="p-1 hover:bg-gray-200 rounded"><Plus size={16}/></button>
        </div>
        
        {/* [수정] 로딩 상태에 따른 조건부 렌더링 */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div 
              className={`p-2 text-sm rounded cursor-pointer flex items-center gap-2 ${selectedSectionId === null ? 'bg-blue-100 text-primary font-bold' : 'hover:bg-gray-100'}`}
              onClick={() => setSelectedSectionId(null)}
            >
              <Folder size={16}/> 모든 케이스
            </div>
            {sections.map(s => (
              <div 
                key={s.id}
                className={`p-2 text-sm rounded cursor-pointer flex items-center justify-between group ${selectedSectionId === s.id ? 'bg-blue-100 text-primary font-bold' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedSectionId(s.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                   <FolderTree size={16} className="flex-shrink-0"/> <span className="truncate">{s.title}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteSection(s.id, e)}
                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 중간 케이스 리스트 패널 */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b flex justify-between items-center bg-white">
           <span className="font-bold text-sm text-gray-700">{filteredCases.length} 케이스</span>
           <div className="flex gap-1">
             <button onClick={() => setImportOpen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="가져오기/내보내기"><ArrowRightLeft size={16}/></button>
             <button onClick={handleCreateCase} className="p-1 hover:bg-blue-50 text-primary rounded"><Plus size={18}/></button>
           </div>
        </div>
        
        {/* [수정] 로딩 상태에 따른 조건부 렌더링 */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredCases.map(c => (
              <div 
                key={c.id} 
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 group ${selectedCase?.id === c.id ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
                onClick={() => { setSelectedCase(c); setIsEditing(false); }}
              >
                <div className="text-xs text-gray-500 mb-1 flex justify-between items-start">
                  <div className="flex gap-2 items-center">
                    <span>{c.id.substr(0,4)}</span>
                    <span className={`px-1 rounded text-[10px] ${c.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{c.priority}</span>
                  </div>
                  <button onClick={(e) => handleDeleteCase(c.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={12}/>
                  </button>
                </div>
                <div className="font-medium text-sm line-clamp-2">{c.title}</div>
              </div>
            ))}
            {filteredCases.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">케이스가 없습니다.</div>}
          </div>
        )}
      </div>

      {/* 3. 오른쪽 상세 패널 (기존 유지) */}
      <div className="flex-1 flex flex-col bg-white">
        {isEditing ? (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <h3 className="text-lg font-bold mb-6 border-b pb-2">케이스 작성 / 수정</h3>
            <div className="space-y-4 max-w-3xl">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">제목</label>
                <input className="w-full border rounded p-2" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">섹션</label>
                    <select className="w-full border rounded p-2" value={editForm.sectionId || ''} onChange={e => setEditForm({...editForm, sectionId: e.target.value})}>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">우선순위</label>
                    <select className="w-full border rounded p-2" value={editForm.priority || 'MEDIUM'} onChange={e => setEditForm({...editForm, priority: e.target.value as any})}>
                      <option value="HIGH">높음 (High)</option>
                      <option value="MEDIUM">중간 (Medium)</option>
                      <option value="LOW">낮음 (Low)</option>
                    </select>
                 </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">사전 조건</label>
                <textarea className="w-full border rounded p-2 h-20" value={editForm.precondition || ''} onChange={e => setEditForm({...editForm, precondition: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">테스트 단계</label>
                <div className="space-y-2">
                  {editForm.steps?.map((step, idx) => (
                    <div key={idx} className="flex gap-2 items-start group">
                      <div className="w-8 text-center text-gray-400 py-2">{idx+1}</div>
                      <textarea 
                        className="flex-1 border rounded p-2 h-16 resize-none" 
                        placeholder="행동 (Action)"
                        value={step.step}
                        onChange={e => {
                           const newSteps = [...(editForm.steps || [])];
                           newSteps[idx].step = e.target.value;
                           setEditForm({...editForm, steps: newSteps});
                        }}
                      />
                      <textarea 
                        className="flex-1 border rounded p-2 h-16 resize-none" 
                        placeholder="기대결과 (Expected)"
                        value={step.expected}
                        onChange={e => {
                           const newSteps = [...(editForm.steps || [])];
                           newSteps[idx].expected = e.target.value;
                           setEditForm({...editForm, steps: newSteps});
                        }}
                      />
                      <button 
                        onClick={() => {
                          const newSteps = editForm.steps?.filter((_, i) => i !== idx);
                          setEditForm({...editForm, steps: newSteps});
                        }}
                        className="text-gray-400 hover:text-red-500 p-2"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setEditForm({...editForm, steps: [...(editForm.steps || []), { id: Date.now().toString(), step: '', expected: '' }]})}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-primary hover:text-primary font-bold flex items-center justify-center gap-2"
                  >
                    <Plus size={16}/> 단계 추가
                  </button>
                </div>
              </div>
              <div className="pt-4 flex gap-2">
                 <button onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded hover:bg-gray-50">취소</button>
                 <button onClick={handleSaveCase} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 font-bold">저장</button>
              </div>
            </div>
          </div>
        ) : selectedCase ? (
          <div className="flex-1 p-8 overflow-y-auto relative">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{selectedCase.type}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${selectedCase.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{selectedCase.priority} Priority</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCase.title}</h2>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={12}/> Created by {getUserName(selectedCase.authorId)} on {new Date(selectedCase.createdAt).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Edit size={12}/> Updated by 
                      <button 
                        onClick={() => setHistoryOpen(true)}
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 ml-1"
                      >
                         (History) {new Date(selectedCase.updatedAt).toLocaleString()}
                      </button>
                    </div>
                  </div>

                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDeleteCase(selectedCase.id)}
                    className="px-3 py-1.5 border rounded hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm font-semibold"
                  >
                    <Trash2 size={16}/> 삭제
                  </button>
                  <button 
                    onClick={() => { setEditForm(JSON.parse(JSON.stringify(selectedCase))); setIsEditing(true); }}
                    className="px-3 py-1.5 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm font-semibold"
                  >
                    <Edit size={16}/> 수정
                  </button>
                </div>
             </div>
             
             <div className="space-y-6">
               {selectedCase.precondition && (
                 <div className="bg-yellow-50 p-4 rounded border border-yellow-100">
                   <h4 className="font-bold text-sm text-yellow-800 mb-1">사전 조건</h4>
                   <p className="text-sm text-gray-700 whitespace-pre-wrap">{formatTextWithNumbers(selectedCase.precondition)}</p>
                 </div>
               )}
               
               <div>
                 <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2"><List size={20}/> 테스트 절차</h4>
                 <div className="border rounded-lg overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                       <tr>
                         <th className="p-3 w-12 text-center">#</th>
                         <th className="p-3 w-1/2 border-r">행동 (Action)</th>
                         <th className="p-3 w-1/2">기대 결과 (Expected)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {selectedCase.steps.map((s, idx) => (
                         <tr key={idx} className="hover:bg-gray-50">
                           <td className="p-3 text-center text-gray-400">{idx+1}</td>
                           <td className="p-3 border-r whitespace-pre-wrap">{formatTextWithNumbers(s.step)}</td>
                           <td className="p-3 whitespace-pre-wrap">{formatTextWithNumbers(s.expected)}</td>
                         </tr>
                       ))}
                       {selectedCase.steps.length === 0 && (
                         <tr><td colSpan={3} className="p-8 text-center text-gray-400">등록된 단계가 없습니다.</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <FileText size={48} className="mb-4 text-gray-200" />
            <p className="text-lg font-medium">테스트 케이스를 선택하거나 생성하세요</p>
          </div>
        )}
      </div>

      <SimpleInputModal 
        isOpen={isSectionModalOpen} 
        onClose={() => setSectionModalOpen(false)} 
        title="새 섹션 생성" 
        label="섹션 이름" 
        placeholder="예: 로그인, 결제 모듈"
        onSubmit={async (val) => { await TestCaseService.createSection({ projectId: project.id, title: val }); loadData(); setSectionModalOpen(false); }}
      />
      <ImportExportModal 
        isOpen={isImportOpen} 
        onClose={() => setImportOpen(false)} 
        project={project} 
        cases={cases} 
        sections={sections} 
        onImportSuccess={loadData}
      />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setHistoryOpen(false)} logs={caseHistory} />
    </div>
  );
};

const TestRunner = ({ project }: { project: Project }) => {
  const { user, users } = useContext(AuthContext);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);
  const [runCases, setRunCases] = useState<TestCase[]>([]);
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isReportOpen, setReportOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(true);
  const [runStats, setRunStats] = useState<Record<string, TestResult[]>>({});

  // 폼 상태
  const [status, setStatus] = useState<TestStatus>('UNTESTED');
  const [actual, setActual] = useState('');
  const [comment, setComment] = useState('');
  const [defectLabel, setDefectLabel] = useState('');
  const [defectUrl, setDefectUrl] = useState('');
  const [stepResults, setStepResults] = useState<{ stepId: string, status: TestStatus }[]>([]);
  
  const [historyExpanded, setHistoryExpanded] = useState(false); // 초기값 닫힘으로 변경 (컴팩트 뷰 위해)
  const [currentResultHistory, setCurrentResultHistory] = useState<ExecutionHistoryItem[]>([]);
  
  // 로딩 상태
  const [loading, setLoading] = useState(true);

  // 실행 목록 로드
  const loadRuns = async () => {
    setLoading(true);
    try {
      const loadedRuns = await RunService.getAll(project.id);
      setRuns(loadedRuns);

      const stats: Record<string, TestResult[]> = {};
      await Promise.all(loadedRuns.map(async (r) => {
         stats[r.id] = await RunService.getResults(r.id);
      }));
      setRunStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    setSelectedRun(null);
  }, [project]);

  // 상세 진입 시 데이터 로드
  useEffect(() => {
    if (selectedRun) {
      Promise.all([
        TestCaseService.getCases(project.id),
        RunService.getResults(selectedRun.id),
        TestCaseService.getSections(project.id)
      ]).then(([allCases, results, sections]) => {
        const sectionMap = new Map(sections.map(s => [s.id, s.title]));
        const casesInRun = allCases
          .filter(c => selectedRun.caseIds.includes(c.id))
          .map(c => ({ ...c, sectionTitle: sectionMap.get(c.sectionId) }));

        setRunCases(casesInRun);
        setRunResults(results);
        setActiveCaseIndex(0);
        loadResultForCase(casesInRun[0], results);
      });
    }
  }, [selectedRun]);

  // 실행 삭제 핸들러
  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (window.confirm("이 테스트 실행(Test Run)을 삭제하시겠습니까?\n포함된 모든 결과 데이터가 영구 삭제됩니다.")) {
      await RunService.delete(runId);
      loadRuns(); 
    }
  };

  // 이전 케이스 이동
  const handlePrev = () => {
    if (activeCaseIndex > 0) {
      const idx = activeCaseIndex - 1;
      setActiveCaseIndex(idx);
      loadResultForCase(runCases[idx], runResults);
    }
  };

  // 다음 케이스 이동
  const handleNext = () => {
    if (activeCaseIndex < runCases.length - 1) {
      const idx = activeCaseIndex + 1;
      setActiveCaseIndex(idx);
      loadResultForCase(runCases[idx], runResults);
    }
  };

  const loadResultForCase = (c: TestCase | undefined, results: TestResult[]) => {
    if (!c) return;
    const res = results.find(r => r.caseId === c.id);
    if (res) {
      setStatus(res.status);
      setActual(res.actualResult);
      setComment(res.comment);
      if (res.issues && res.issues.length > 0) {
        setDefectLabel(res.issues[0].label);
        setDefectUrl(res.issues[0].url);
      } else {
        setDefectLabel('');
        setDefectUrl('');
      }
      setStepResults(res.stepResults || []);
      setCurrentResultHistory(res.history || []);
    } else {
      setStatus('UNTESTED');
      setActual('');
      setComment('');
      setDefectLabel('');
      setDefectUrl('');
      setStepResults([]);
      setCurrentResultHistory([]);
    }
    // 케이스 이동 시 히스토리는 닫아둠 (깔끔하게)
    setHistoryExpanded(false);
  };

  const autoSave = async (
    targetStatus: TestStatus, 
    targetActual: string, 
    targetComment: string, 
    targetDefectLabel: string, 
    targetDefectUrl: string, 
    targetStepResults: { stepId: string, status: TestStatus }[]
  ) => {
    if (!selectedRun || !runCases[activeCaseIndex] || !user) return;
    
    const currentCase = runCases[activeCaseIndex];
    const issues: Issue[] = [];
    if (targetDefectLabel && targetDefectUrl) {
      issues.push({ id: Date.now().toString(), label: targetDefectLabel, url: targetDefectUrl });
    }

    const payload: Partial<TestResult> = {
      runId: selectedRun.id,
      caseId: currentCase.id,
      status: targetStatus,
      actualResult: targetActual,
      comment: targetComment,
      testerId: user.id,
      stepResults: targetStepResults,
      issues
    };

    await RunService.saveResult(payload);
    
    const updatedRes = { ...payload, id: 'temp' } as TestResult;
    setRunResults(prev => [...prev.filter(r => r.caseId !== currentCase.id), updatedRes]);
    
    const currentRunStats = runStats[selectedRun.id] || [];
    const newStats = [...currentRunStats.filter(r => r.caseId !== currentCase.id), updatedRes];
    setRunStats(prev => ({ ...prev, [selectedRun.id]: newStats }));
    
    RunService.getResults(selectedRun.id).then(results => {
       const fresh = results.find(r => r.caseId === currentCase.id);
       if (fresh) setCurrentResultHistory(fresh.history || []);
    });
  };

  const handleStepStatusChange = (stepId: string, newStepStatus: TestStatus) => {
    const newStepResults = stepResults.filter(sr => sr.stepId !== stepId);
    newStepResults.push({ stepId, status: newStepStatus });
    setStepResults(newStepResults);

    let calculatedStatus: TestStatus = 'PASS';
    const hasFail = newStepResults.some(s => s.status === 'FAIL');
    const hasBlock = newStepResults.some(s => s.status === 'BLOCK');
    
    if (hasFail) calculatedStatus = 'FAIL';
    else if (hasBlock) calculatedStatus = 'BLOCK';
    
    setStatus(calculatedStatus);
    autoSave(calculatedStatus, actual, comment, defectLabel, defectUrl, newStepResults);
  };

  const handleStatusChange = (newStatus: TestStatus) => {
    setStatus(newStatus);
    autoSave(newStatus, actual, comment, defectLabel, defectUrl, stepResults);
  };

  const forcePassAndNext = async () => {
    if (!selectedRun || !runCases[activeCaseIndex]) return;
    await autoSave('PASS', actual, comment, defectLabel, defectUrl, stepResults);
    
    if (activeCaseIndex < runCases.length - 1) {
      const idx = activeCaseIndex + 1;
      setActiveCaseIndex(idx);
      loadResultForCase(runCases[idx], runResults);
    }
  };

  const getRunStats = () => {
    const total = runCases.length;
    const pass = runResults.filter(r => r.status === 'PASS').length;
    const fail = runResults.filter(r => r.status === 'FAIL').length;
    const block = runResults.filter(r => r.status === 'BLOCK').length;
    const tested = runResults.length;
    const untested = total - tested;
    return { total, pass, fail, block, untested };
  };
  
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  const stats = getRunStats();

  const getStatusColor = (s: TestStatus) => {
    switch(s) {
      case 'PASS': return 'bg-green-100 text-green-700 border-green-500';
      case 'FAIL': return 'bg-red-100 text-red-700 border-red-500';
      case 'BLOCK': return 'bg-gray-800 text-white border-gray-900';
      case 'NA': return 'bg-orange-100 text-orange-700 border-orange-500';
      default: return 'bg-gray-100 text-gray-500 border-gray-300';
    }
  };

  const fullHistoryTimeline: (ExecutionHistoryItem & { isCurrent?: boolean })[] = status === 'UNTESTED' ? [] : [
    {
      status,
      actualResult: actual,
      comment,
      testerId: user?.id || 'unknown',
      timestamp: new Date().toISOString(),
      issues: (defectLabel && defectUrl) ? [{id: 'temp', label: defectLabel, url: defectUrl}] : [],
      stepResults,
      isCurrent: true
    },
    ...currentResultHistory.map(h => ({ ...h, isCurrent: false }))
  ];

  // 1. 실행 목록 화면
  if (!selectedRun) {
    if (loading) return <LoadingSpinner />;

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">테스트 실행 (Test Runs)</h2>
          <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 flex items-center gap-2">
            <PlayCircle size={18}/> 실행 계획 생성
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {runs.map(run => {
            const results = runStats[run.id] || [];
            const pass = results.filter(r => r.status === 'PASS').length;
            const fail = results.filter(r => r.status === 'FAIL').length;
            const total = run.caseIds?.length || 0;
            const passWidth = total > 0 ? (pass / total) * 100 : 0;
            const failWidth = total > 0 ? (fail / total) * 100 : 0;

            return (
              <div key={run.id} className="bg-white p-4 rounded shadow border hover:border-primary cursor-pointer group" onClick={() => setSelectedRun(run)}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-primary">{run.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{new Date(run.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={(e) => handleDeleteRun(run.id, e)}
                      className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded transition opacity-0 group-hover:opacity-100"
                      title="실행 계획 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: `${passWidth}%` }} />
                      <div className="bg-red-500 h-full" style={{ width: `${failWidth}%` }} />
                   </div>
                   <span className="text-xs font-bold text-gray-500">{total} Cases</span>
                </div>
              </div>
            );
          })}
          {runs.length === 0 && <div className="text-center py-10 text-gray-500">생성된 실행 계획이 없습니다.</div>}
        </div>
        <RunCreationModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} project={project} onSubmit={async (t, ids) => { await RunService.create({projectId: project.id, title: t, caseIds: ids}); loadRuns(); }} />
      </div>
    );
  }

  // 2. 실행 상세 화면 (로딩 중)
  if (runCases.length === 0) return <LoadingSpinner />;

  const activeCase = runCases[activeCaseIndex];
  if (!activeCase) return <div>Data Error</div>;

  // 3. 실행 상세 화면 (렌더링)
  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
         <div className="flex items-center gap-4">
           <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
             <ArrowLeft size={24} />
           </button>
           
           <div>
             <h2 className="font-bold text-xl text-gray-900 leading-tight">{selectedRun.title}</h2>
             
             {/* 상단 네비게이션 및 통계 바 */}
             <div className="flex items-center gap-3 mt-1.5">
                <button 
                  onClick={() => setDashboardOpen(!isDashboardOpen)} 
                  className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-sm font-bold text-gray-700 transition"
                  title="통계 대시보드 열기/접기"
                >
                  <span>{activeCaseIndex + 1} / {runCases.length}</span>
                  {isDashboardOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>

                <div className="h-4 w-px bg-gray-300 mx-1"></div> 
                <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                   <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(stats.pass / stats.total)*100}%` }} title={`Pass: ${stats.pass}`}/>
                   <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(stats.fail / stats.total)*100}%` }} title={`Fail: ${stats.fail}`}/>
                   <div className="h-full bg-gray-800 transition-all duration-500" style={{ width: `${(stats.block / stats.total)*100}%` }} title={`Block: ${stats.block}`}/>
                </div>
             </div>
           </div>
         </div>

         <div className="flex gap-2">
           <button onClick={() => setReportOpen(true)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-bold text-gray-700 shadow-sm transition">
             <BarChart2 size={18}/> 리포트
           </button>
         </div>
      </div>

      {/* 대시보드 영역 */}
      {isDashboardOpen && (
        <div className="bg-white border-b p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
           <div className="max-w-6xl mx-auto flex gap-8 items-center justify-center">
              <div className="h-32 w-32 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Pass', value: stats.pass, fill: '#22c55e' },
                          { name: 'Fail', value: stats.fail, fill: '#ef4444' },
                          { name: 'Block', value: stats.block, fill: '#1f2937' },
                          { name: 'Untested', value: stats.untested, fill: '#e5e7eb' }
                        ]}
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={2}
                        dataKey="value"
                      >
                         <Cell fill="#22c55e" />
                         <Cell fill="#ef4444" />
                         <Cell fill="#1f2937" />
                         <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex items-center justify-center font-bold text-gray-600 text-xs">
                    {Math.round((stats.pass / stats.total) * 100) || 0}%
                 </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                 <div className="p-3 bg-green-50 rounded border border-green-100 w-24 text-center">
                    <div className="text-xs font-bold text-green-700 uppercase">Pass</div>
                    <div className="text-xl font-bold text-green-800">{stats.pass}</div>
                 </div>
                 <div className="p-3 bg-red-50 rounded border border-red-100 w-24 text-center">
                    <div className="text-xs font-bold text-red-700 uppercase">Fail</div>
                    <div className="text-xl font-bold text-red-800">{stats.fail}</div>
                 </div>
                 <div className="p-3 bg-gray-100 rounded border border-gray-200 w-24 text-center">
                    <div className="text-xs font-bold text-gray-700 uppercase">Block</div>
                    <div className="text-xl font-bold text-gray-800">{stats.block}</div>
                 </div>
                 <div className="p-3 bg-white rounded border border-gray-200 w-24 text-center">
                    <div className="text-xs font-bold text-gray-400 uppercase">Untested</div>
                    <div className="text-xl font-bold text-gray-500">{stats.untested}</div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 메인 작업 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 케이스 목록 리스트 */}
        <div className="w-72 bg-white border-r overflow-y-auto">
          {runCases.map((c, idx) => {
            const res = runResults.find(r => r.caseId === c.id);
            const status = res?.status || 'UNTESTED';
            return (
              <div 
                key={c.id} 
                onClick={() => { setActiveCaseIndex(idx); loadResultForCase(c, runResults); }}
                className={`p-3 border-b cursor-pointer flex items-center gap-2 text-sm hover:bg-gray-50 ${activeCaseIndex === idx ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
              >
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status === 'PASS' ? 'bg-green-500' : status === 'FAIL' ? 'bg-red-500' : status === 'BLOCK' ? 'bg-gray-800' : 'bg-gray-300'}`} />
                <span className="truncate flex-1">{c.title}</span>
              </div>
            );
          })}
        </div>

        {/* 오른쪽: 상세 및 실행 (개선된 UI) */}
        <div className="flex-1 flex overflow-hidden relative group bg-gray-100">
           
           {/* [NEW] 1. 이전 케이스 이동 버튼 (플로팅) */}
           <button 
              onClick={handlePrev}
              disabled={activeCaseIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 text-gray-400 flex items-center justify-center hover:text-primary hover:border-primary hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none"
              title="이전 케이스 (Previous)"
           >
              <ChevronLeft size={32} />
           </button>

           {/* [NEW] 2. 다음 케이스 이동 버튼 (플로팅) */}
           <button 
              onClick={handleNext}
              disabled={activeCaseIndex === runCases.length - 1}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 text-gray-400 flex items-center justify-center hover:text-primary hover:border-primary hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none"
              title="다음 케이스 (Next)"
           >
              <ChevronRight size={32} />
           </button>

           {/* 메인 컨텐츠 영역 (스크롤 가능) */}
           <div className="flex-1 overflow-y-auto px-12 py-6">
              <div className="max-w-5xl mx-auto space-y-4">
                
                {/* A. 케이스 헤더 정보 */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                   <div className="flex gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-600 border">{activeCase.sectionTitle || 'General'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${activeCase.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{activeCase.priority} Priority</span>
                   </div>
                   <h1 className="text-2xl font-bold text-gray-900 mb-2">{activeCase.title}</h1>
                   {activeCase.precondition && (
                     <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200 whitespace-pre-wrap flex gap-2">
                       <AlertOctagon size={16} className="mt-0.5 flex-shrink-0"/>
                       <div><strong>Precondition:</strong> {formatTextWithNumbers(activeCase.precondition)}</div>
                     </div>
                   )}
                </div>

                {/* B. 테스트 스텝 (시각적 강조) */}
                <div className="space-y-3">
                   {activeCase.steps.map((step, i) => {
                     const stepRes = stepResults.find(sr => sr.stepId === step.id)?.status || 'UNTESTED';
                     return (
                     <div key={i} className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">{i+1}</div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-6">
                           <div className="space-y-1">
                             <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Action</div>
                             <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{formatTextWithNumbers(step.step)}</div>
                           </div>
                           <div className="space-y-1 pl-6 border-l border-gray-100">
                             <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Expected Result</div>
                             <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{formatTextWithNumbers(step.expected)}</div>
                           </div>
                        </div>

                        <div className="flex flex-col gap-1 w-16 flex-shrink-0 justify-center">
                           <button 
                              onClick={() => handleStepStatusChange(step.id, 'PASS')}
                              className={`h-8 text-[10px] font-bold rounded border transition-all ${stepRes === 'PASS' ? 'bg-green-500 text-white border-green-600 shadow-sm' : 'bg-white text-gray-300 hover:text-green-600 hover:border-green-200'}`}
                           >PASS</button>
                           <button 
                              onClick={() => handleStepStatusChange(step.id, 'FAIL')}
                              className={`h-8 text-[10px] font-bold rounded border transition-all ${stepRes === 'FAIL' ? 'bg-red-500 text-white border-red-600 shadow-sm' : 'bg-white text-gray-300 hover:text-red-600 hover:border-red-200'}`}
                           >FAIL</button>
                        </div>
                     </div>
                   )})}
                </div>

                {/* C. 결과 입력 섹션 (Compact Mode) */}
                <div className={`rounded-xl p-4 transition-colors shadow-sm border-2 ${getStatusColor(status).replace('text-', 'border-').split(' ')[2]} bg-white`}>
                   <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><PlayCircle size={18}/> Test Result</h3>
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {(['PASS', 'FAIL', 'BLOCK', 'NA'] as TestStatus[]).map(s => (
                          <button 
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${status === s ? getStatusColor(s) + ' shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                   </div>

                   {/* 입력 필드 (Grid Layout) */}
                   <div className="grid grid-cols-2 gap-4">
                      {/* 1. Actual Result */}
                      <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Actual Result</label>
                         <textarea 
                            className="w-full border rounded p-2 text-sm h-16 resize-none focus:ring-1 focus:ring-primary focus:border-primary" 
                            placeholder="실제 결과 입력..." 
                            value={actual} 
                            onChange={e => setActual(e.target.value)}
                            onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                         />
                      </div>
                      
                      {/* 2. Comment & Defect */}
                      <div className="space-y-2">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Comment</label>
                            <input 
                               className="w-full border rounded p-2 text-sm h-8 focus:ring-1 focus:ring-primary focus:border-primary" 
                               placeholder="비고 사항..." 
                               value={comment} 
                               onChange={e => setComment(e.target.value)}
                               onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                            />
                         </div>

                         {status === 'FAIL' && (
                           <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                              <div className="relative flex-1">
                                <Bug size={14} className="absolute left-2 top-2 text-red-400"/>
                                <input 
                                    className="w-full border border-red-200 bg-red-50 rounded pl-7 p-1.5 text-xs h-8 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500" 
                                    placeholder="Issue Key (QA-123)" 
                                    value={defectLabel} 
                                    onChange={e => setDefectLabel(e.target.value)}
                                    onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                                 />
                              </div>
                              <input 
                                  className="flex-[2] border border-red-200 bg-red-50 rounded p-1.5 text-xs h-8 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500" 
                                  placeholder="Issue URL..." 
                                  value={defectUrl} 
                                  onChange={e => setDefectUrl(e.target.value)}
                                  onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                               />
                           </div>
                         )}
                         {status !== 'FAIL' && (
                            <div className="h-8 flex items-center justify-end">
                               <button onClick={forcePassAndNext} className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded shadow hover:bg-blue-600 flex items-center gap-1 transition-colors">
                                 <CheckCircle size={14}/> Pass & Next
                               </button>
                            </div>
                         )}
                      </div>
                   </div>
                   
                   {status === 'FAIL' && (
                     <div className="mt-2 flex justify-end">
                        <button onClick={forcePassAndNext} className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded shadow hover:bg-blue-600 flex items-center gap-1">
                           <CheckCircle size={14}/> Save & Next
                        </button>
                     </div>
                   )}
                </div>
                
                {/* D. 실행 이력 (최소화) */}
                <div className="border-t pt-2">
                  <button 
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="w-full flex justify-between items-center text-gray-400 font-bold hover:text-gray-600 p-1 text-xs"
                  >
                    <span className="flex items-center gap-2"><RotateCcw size={14}/> Execution History</span>
                    {historyExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                  
                  {historyExpanded && (
                    <div className="mt-2 space-y-2 pl-2">
                      {fullHistoryTimeline.length === 0 && <div className="text-center text-gray-300 text-xs py-2">No history.</div>}
                      {fullHistoryTimeline.map((h, idx) => (
                        <div key={idx} className="flex gap-2 items-start text-xs text-gray-500">
                           <span className={`px-1.5 rounded font-bold ${h.status==='PASS'?'bg-green-100 text-green-700':h.status==='FAIL'?'bg-red-100 text-red-700':'bg-gray-100'}`}>{h.status}</span>
                           <span>{new Date(h.timestamp).toLocaleDateString()} by {getUserName(h.testerId)}</span>
                           {h.isCurrent && <span className="text-blue-500 font-bold">(Current)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
           </div>
        </div>
      </div>
      <ReportModal isOpen={isReportOpen} onClose={() => setReportOpen(false)} project={project} />
    </div>
  );
};

const AdminPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { AuthService.getAllUsers().then(setUsers); }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Users/> 사용자 관리</h2>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">이름</th>
              <th className="p-4">이메일</th>
              <th className="p-4">권한</th>
              <th className="p-4">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="p-4 font-bold">{u.name}</td>
                <td className="p-4 text-gray-600">{u.email}</td>
                <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                <td className="p-4"><span className="text-green-600 font-bold text-xs">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<'DASHBOARD' | 'CASES' | 'RUNS' | 'ADMIN' | 'PROJECTS'>('DASHBOARD');
  
  // 모달 및 드롭다운 상태
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isProjectDropdownOpen, setProjectDropdownOpen] = useState(false);
  
  // [추가] 수정 중인 프로젝트 상태 (null이면 생성 모드)
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 초기 로그인 및 데이터 로드
  useEffect(() => {
    const u = AuthService.getCurrentUser();
    if (u && u.id && u.name && u.email) {
      setUser(u);
      loadProjects();
      AuthService.getAllUsers().then(setUsers);
    } else {
      AuthService.logout();
      setUser(null);
    }
  }, []);

  // [수정] 프로젝트 목록 로드 및 '마지막 접속 프로젝트' 자동 선택
  const loadProjects = async () => {
    const list = await ProjectService.getAll();
    setProjects(list);
    
    // 리스트가 있는데 선택된 프로젝트가 없다면 (초기 진입 시)
    if (list.length > 0 && !activeProject) {
      // 1. 로컬 스토리지에서 마지막으로 봤던 프로젝트 ID 조회
      const lastId = localStorage.getItem('lastActiveProjectId');
      
      // 2. 해당 ID가 실제 목록에 존재하는지 확인
      const lastProject = list.find(p => p.id === lastId);
      
      if (lastProject) {
        setActiveProject(lastProject); // 존재하면 해당 프로젝트 선택
      } else {
        setActiveProject(list[0]); // 없으면 가장 최신(첫 번째) 프로젝트 선택
      }
    }
  };

  // [추가] 프로젝트가 변경될 때마다 로컬 스토리지에 ID 저장
  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('lastActiveProjectId', activeProject.id);
    }
  }, [activeProject]);

  const login = async (email: string) => {
    const u = await AuthService.login(email);
    if (u) {
      setUser(u);
      loadProjects();
      AuthService.getAllUsers().then(setUsers);
    } else {
      alert("로그인 실패");
    }
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    setActiveProject(null);
    localStorage.removeItem('lastActiveProjectId'); // 로그아웃 시 기록 삭제 (선택사항)
  };

  // [추가] 프로젝트 삭제 핸들러
  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm("경고: 프로젝트를 삭제하면 포함된 모든 테스트 케이스, 실행 이력, 결과가 영구적으로 삭제됩니다.\n\n정말 삭제하시겠습니까?")) {
      await ProjectService.delete(projectId);
      await loadProjects(); // 목록 갱신
      
      // 만약 삭제한 프로젝트를 보고 있었다면 대시보드에서 나감
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setView('PROJECTS');
      }
    }
  };

  // [추가] 모달 닫기 핸들러 (상태 초기화)
  const closeProjectModal = () => {
    setProjectModalOpen(false);
    setEditingProject(null); // 수정 모드 종료
  };

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, login, logout, users: [] }}>
        <LoginScreen />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, users }}>
      <div className="flex h-screen bg-gray-100 text-gray-900 font-sans">
        {/* 사이드바 영역 */}
        <div className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-xl font-bold tracking-tight text-blue-400 mb-4">QA Manager</h1>
            
            <div className="relative">
              <button 
                onClick={() => setProjectDropdownOpen(!isProjectDropdownOpen)} 
                className={`w-full text-left bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition flex justify-between items-center ${isProjectDropdownOpen ? 'ring-1 ring-blue-500' : ''}`}
              >
                <div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Active Project</div>
                  <div className="font-bold truncate">{activeProject?.title || 'No Project'}</div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`}/>
              </button>

              {isProjectDropdownOpen && (
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setProjectDropdownOpen(false)}></div>
              )}

              {isProjectDropdownOpen && (
                <div className="absolute top-full left-0 w-full bg-white text-gray-900 rounded shadow-xl mt-1 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                   <div className="px-2 py-1.5 border-b mb-1">
                      <button onClick={() => { setView('PROJECTS'); setProjectDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm font-bold flex items-center gap-2 text-gray-700">
                          <LayoutGrid size={16}/> 전체 프로젝트 보기
                      </button>
                   </div>
                   <div className="max-h-64 overflow-y-auto">
                      {projects.map(p => (
                        <div key={p.id} onClick={() => { setActiveProject(p); setView('DASHBOARD'); setProjectDropdownOpen(false); }} className="px-4 py-2 hover:bg-gray-100 cursor-pointer font-medium text-sm flex justify-between">
                          {p.title}
                          {activeProject?.id === p.id && <CheckCircle size={14} className="text-green-500"/>}
                        </div>
                      ))}
                   </div>
                   <div className="border-t mt-1 pt-1 px-2 pb-1">
                      <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); setProjectDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-blue-600 text-xs font-bold rounded flex items-center gap-1">
                        <Plus size={12}/> 새 프로젝트 생성
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setView('DASHBOARD')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === 'DASHBOARD' ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <LayoutDashboard size={18} /> 대시보드
            </button>
            <button onClick={() => setView('CASES')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === 'CASES' ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <FolderTree size={18} /> 테스트 케이스
            </button>
            <button onClick={() => setView('RUNS')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === 'RUNS' ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <PlayCircle size={18} /> 테스트 실행
            </button>
            {user.role === 'ADMIN' && (
              <button onClick={() => setView('ADMIN')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === 'ADMIN' ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <Settings size={18} /> 관리자 설정
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-white text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-bold text-white truncate">{user.name}</div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center gap-2 text-gray-400 hover:text-white text-sm px-2 transition">
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'PROJECTS' ? (
             <ProjectList 
               projects={projects} 
               onSelect={(p) => { setActiveProject(p); setView('DASHBOARD'); }} 
               onCreate={() => { setEditingProject(null); setProjectModalOpen(true); }} // 생성 모드
               onEdit={(p) => { setEditingProject(p); setProjectModalOpen(true); }}     // 수정 모드
               onDelete={handleDeleteProject} // 삭제 핸들러
             />
          ) : activeProject ? (
            <>
              {view === 'DASHBOARD' && <Dashboard project={activeProject} />}
              {view === 'CASES' && <TestCaseManager project={activeProject} />}
              {view === 'RUNS' && <TestRunner project={activeProject} />}
              {view === 'ADMIN' && <AdminPanel />}
            </>
          ) : (
             // 활성 프로젝트가 없으면 프로젝트 리스트 보여줌
             <ProjectList 
               projects={projects} 
               onSelect={(p) => { setActiveProject(p); setView('DASHBOARD'); }} 
               onCreate={() => { setEditingProject(null); setProjectModalOpen(true); }} 
               onEdit={(p) => { setEditingProject(p); setProjectModalOpen(true); }}
               onDelete={handleDeleteProject}
             />
          )}
        </div>
        
        {/* 프로젝트 생성/수정 모달 */}
        <ProjectModal 
          isOpen={isProjectModalOpen} 
          onClose={closeProjectModal}
          initialData={editingProject || undefined} // 수정 시 기존 데이터 주입
          onSubmit={async (t, d, s) => { 
            if (editingProject) {
              // 수정 로직
              await ProjectService.update({ ...editingProject, title: t, description: d, status: s });
            } else {
              // 생성 로직
              await ProjectService.create({ title: t, description: d, status: s });
            }
            await loadProjects(); // 목록 갱신
            closeProjectModal();
          }} 
        />
      </div>
    </AuthContext.Provider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);