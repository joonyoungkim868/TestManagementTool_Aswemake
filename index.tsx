import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Layout, LayoutDashboard, FolderTree, PlayCircle, Settings, Users, LogOut, 
  Plus, ChevronRight, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Clock, Save, History, Search, Filter,
  Download, Upload, FileText, AlertTriangle, ArrowRightLeft, ArrowRight, CheckSquare, Square,
  Play, PauseCircle, SkipForward, ArrowLeft, MoreVertical, Edit, Archive, Folder, Grid, List, Trash2, Bug, ExternalLink, BarChart2,
  Table, Link as LinkIcon, MinusCircle, HelpCircle, LayoutGrid, RotateCcw
} from 'lucide-react';
import { 
  AuthService, ProjectService, TestCaseService, RunService, HistoryService 
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

const ConfirmModal = ({ isOpen, onClose, message, onConfirm }: { isOpen: boolean, onClose: () => void, message: string, onConfirm: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2"><AlertTriangle size={24}/> 삭제 확인</h3>
        <p className="text-gray-700 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50 font-medium text-gray-700">취소</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold shadow-sm">삭제</button>
        </div>
      </div>
    </div>
  );
};

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
  const [email, setEmail] = useState('admin@company.com');
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

const ProjectList = ({ projects, onSelect, onCreate }: { projects: Project[], onSelect: (p: Project) => void, onCreate: () => void }) => {
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
          {projects.map(p => (
            <div key={p.id} onClick={() => onSelect(p)} className="bg-white rounded-xl shadow-sm border hover:border-primary hover:shadow-md cursor-pointer transition p-6 flex flex-col h-48 group">
               <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg ${p.status === 'ACTIVE' ? 'bg-blue-100 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                    <Folder size={24} />
                  </div>
                  {p.status === 'ACTIVE' ? (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Active</span>
                  ) : (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-bold">Archived</span>
                  )}
               </div>
               <h3 className="font-bold text-xl text-gray-900 mb-2 truncate group-hover:text-primary transition-colors">{p.title}</h3>
               <p className="text-sm text-gray-500 line-clamp-2 flex-1">{p.description || '설명이 없습니다.'}</p>
               <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex justify-between items-center">
                  <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-primary transition-colors" />
               </div>
            </div>
          ))}
          {/* Create Placeholder */}
          <div onClick={onCreate} className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-blue-50 cursor-pointer transition h-48">
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

const ImportExportModal = ({ 
  isOpen, onClose, project, cases, sections, onImportSuccess 
}: { 
  isOpen: boolean, onClose: () => void, project: Project, cases: TestCase[], sections: Section[], onImportSuccess: () => void 
}) => {
  const { user } = useContext(AuthContext);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setError(null);
      setImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const processImport = async () => {
    if (!file || !user) return;
    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      let importedCases: Partial<TestCase>[] = [];

      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          importedCases = json.map((c: any) => ({
             title: c.title,
             sectionTitle: sections.find(s => s.id === c.sectionId)?.title || c.sectionTitle || 'Imported',
             priority: normalizePriority(c.priority),
             type: normalizeType(c.type),
             precondition: c.precondition,
             steps: c.steps
          }));
        }
      } else if (file.name.endsWith('.csv')) {
        const rows = parseCSV(text);
        // Remove header if present
        if (rows.length > 0 && rows[0][0] === 'Section') rows.shift();

        let currentCase: Partial<TestCase> | null = null;
        
        for (const row of rows) {
          const [sec, title, prio, type, pre, step, exp] = row;
          
          if (title && title.trim()) {
            // New Case
            if (currentCase) importedCases.push(currentCase);
            currentCase = {
              title: title,
              sectionTitle: sec || 'Imported',
              priority: normalizePriority(prio),
              type: normalizeType(type),
              precondition: (pre || '').replace(/\\n/g, '\n'),
              steps: []
            };
          }

          if (currentCase && (step || exp)) {
            if (!currentCase.steps) currentCase.steps = [];
            currentCase.steps.push({
              id: Date.now().toString() + Math.random(),
              step: (step || '').replace(/\\n/g, '\n'),
              expected: (exp || '').replace(/\\n/g, '\n')
            });
          }
        }
        if (currentCase) importedCases.push(currentCase);
      }

      if (importedCases.length > 0) {
        await TestCaseService.importCases(project.id, importedCases, user);
        onImportSuccess();
        onClose();
      } else {
        setError("파일에서 유효한 테스트 케이스를 찾을 수 없습니다.");
      }
    } catch (e: any) {
      console.error(e);
      setError("가져오기 실패: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ArrowRightLeft size={20}/> 가져오기 / 내보내기</h3>
        
        <div className="mb-6">
          <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">내보내기 (Export)</h4>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(cases, sections)} className="flex-1 py-2 border rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium">
              <Table size={16} className="text-green-600"/> CSV로 내보내기
            </button>
            <button onClick={() => exportToJSON(cases)} className="flex-1 py-2 border rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium">
              <FileText size={16} className="text-blue-600"/> JSON으로 백업
            </button>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">가져오기 (Import)</h4>
          <div className="space-y-3">
             <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition relative">
               <input 
                 type="file" 
                 accept=".csv,.json" 
                 onChange={handleFileChange}
                 className="absolute inset-0 opacity-0 cursor-pointer"
               />
               {file ? (
                 <div className="text-sm font-bold text-primary flex items-center justify-center gap-2">
                   <CheckCircle size={16}/> {file.name}
                 </div>
               ) : (
                 <div className="text-gray-400 text-sm">
                   <Upload size={24} className="mx-auto mb-2"/>
                   <p>CSV 또는 JSON 파일을 드래그하거나 클릭하여 선택하세요.</p>
                 </div>
               )}
             </div>
             {error && <div className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</div>}
             <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">취소</button>
                <button 
                  disabled={!file || importing} 
                  onClick={processImport}
                  className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 shadow-sm"
                >
                  {importing ? '가져오는 중...' : '가져오기 실행'}
                </button>
             </div>
          </div>
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
  
  // [NEW] Custom Confirm Modal State
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, message: string, onConfirm: () => void }>({
    isOpen: false, message: '', onConfirm: () => {}
  });

  const loadData = () => {
    Promise.all([
      TestCaseService.getSections(project.id),
      TestCaseService.getCases(project.id)
    ]).then(([s, c]) => {
      setSections(s);
      setCases(c);
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
    setSelectedCase(saved); // Load the saved case
  };
  
  const requestDeleteCase = (caseId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setConfirmState({
      isOpen: true,
      message: "정말 이 테스트 케이스를 삭제하시겠습니까?",
      onConfirm: async () => {
        await TestCaseService.deleteCase(caseId);
        loadData();
        if (selectedCase?.id === caseId) {
          setSelectedCase(null);
          setIsEditing(false);
        }
      }
    });
  };

  const requestDeleteSection = (sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const count = cases.filter(c => c.sectionId === sectionId).length;
    setConfirmState({
      isOpen: true,
      message: `섹션을 삭제하시겠습니까?\n포함된 ${count}개의 테스트 케이스도 모두 영구 삭제됩니다.`,
      onConfirm: async () => {
        await TestCaseService.deleteSection(sectionId);
        loadData();
        if (selectedSectionId === sectionId) setSelectedSectionId(null);
      }
    });
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="flex h-full bg-white rounded shadow overflow-hidden">
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        <div className="p-3 border-b flex justify-between items-center">
          <span className="font-bold text-gray-700 text-sm">섹션 (Folders)</span>
          <button onClick={() => setSectionModalOpen(true)} className="p-1 hover:bg-gray-200 rounded"><Plus size={16}/></button>
        </div>
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
                onClick={(e) => requestDeleteSection(s.id, e)}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b flex justify-between items-center bg-white">
           <span className="font-bold text-sm text-gray-700">{filteredCases.length} 케이스</span>
           <div className="flex gap-1">
             <button onClick={() => setImportOpen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="가져오기/내보내기"><ArrowRightLeft size={16}/></button>
             <button onClick={handleCreateCase} className="p-1 hover:bg-blue-50 text-primary rounded"><Plus size={18}/></button>
           </div>
        </div>
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
                <button onClick={(e) => requestDeleteCase(c.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Trash2 size={12}/>
                </button>
              </div>
              <div className="font-medium text-sm line-clamp-2">{c.title}</div>
            </div>
          ))}
        </div>
      </div>

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
                  
                  {/* Metadata Header */}
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
                    onClick={() => requestDeleteCase(selectedCase.id)}
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
      <ConfirmModal 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({...confirmState, isOpen: false})} 
        message={confirmState.message} 
        onConfirm={confirmState.onConfirm} 
      />
    </div>
  );
};

const Dashboard = ({ project }: { project: Project }) => {
  const [stats, setStats] = useState({ caseCount: 0, runCount: 0, passRate: 0, defectCount: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      TestCaseService.getCases(project.id),
      RunService.getAll(project.id)
    ]).then(([cases, runs]) => {
      // Mock Data for Demo
      setStats({
        caseCount: cases.length,
        runCount: runs.length,
        passRate: 85,
        defectCount: 12
      });
      setChartData([
        { name: 'Mon', pass: 40, fail: 2 },
        { name: 'Tue', pass: 30, fail: 5 },
        { name: 'Wed', pass: 50, fail: 1 },
        { name: 'Thu', pass: 20, fail: 0 },
        { name: 'Fri', pass: 45, fail: 3 },
      ]);
    });
  }, [project]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <h1 className="text-3xl font-bold mb-8">대시보드</h1>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-gray-500 text-sm font-medium">총 테스트 케이스</div>
          <div className="text-3xl font-bold mt-2">{stats.caseCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-gray-500 text-sm font-medium">진행 중인 실행</div>
          <div className="text-3xl font-bold mt-2">{stats.runCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-gray-500 text-sm font-medium">평균 통과율</div>
          <div className="text-3xl font-bold mt-2 text-green-600">{stats.passRate}%</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-gray-500 text-sm font-medium">오픈된 결함</div>
          <div className="text-3xl font-bold mt-2 text-red-500">{stats.defectCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border h-80">
          <h3 className="font-bold text-lg mb-4">최근 7일 수행 추이</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pass" fill="#22c55e" name="Pass" />
              <Bar dataKey="fail" fill="#ef4444" name="Fail" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const TestRunManager = ({ project }: { project: Project }) => {
  const { user } = useContext(AuthContext);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [runResults, setRunResults] = useState<TestResult[]>([]);
  const [runCases, setRunCases] = useState<TestCase[]>([]);
  const [activeCase, setActiveCase] = useState<TestCase | null>(null);
  
  // Runner State
  const [status, setStatus] = useState<TestStatus>('UNTESTED');
  const [comment, setComment] = useState('');
  
  const loadRuns = () => {
    RunService.getAll(project.id).then(setRuns);
  };

  useEffect(() => {
    loadRuns();
    setSelectedRun(null);
  }, [project]);

  useEffect(() => {
    if (selectedRun) {
      RunService.getResults(selectedRun.id).then(setRunResults);
      TestCaseService.getCases(project.id).then(all => {
        setRunCases(all.filter(c => selectedRun.caseIds.includes(c.id)));
      });
    }
  }, [selectedRun]);

  useEffect(() => {
    if (activeCase && selectedRun) {
       const res = runResults.find(r => r.caseId === activeCase.id);
       setStatus(res?.status || 'UNTESTED');
       setComment(res?.comment || '');
    }
  }, [activeCase]);

  const handleResultSubmit = async (newStatus: TestStatus) => {
    if (!selectedRun || !activeCase || !user) return;
    await RunService.saveResult({
      runId: selectedRun.id,
      caseId: activeCase.id,
      status: newStatus,
      comment,
      testerId: user.id
    });
    
    // Refresh results
    const updatedResults = await RunService.getResults(selectedRun.id);
    setRunResults(updatedResults);
    
    if (newStatus === 'PASS') {
       // Auto next
       const idx = runCases.findIndex(c => c.id === activeCase.id);
       if (idx < runCases.length - 1) setActiveCase(runCases[idx+1]);
    }
  };

  if (selectedRun) {
    return (
      <div className="flex h-full bg-white">
        <div className="w-80 border-r flex flex-col bg-gray-50">
           <div className="p-4 border-b flex items-center gap-2 bg-white">
             <button onClick={() => setSelectedRun(null)}><ArrowLeft size={20}/></button>
             <div className="font-bold truncate">{selectedRun.title}</div>
           </div>
           <div className="p-4 border-b bg-white">
             <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round((runResults.filter(r => r.status !== 'UNTESTED').length / runCases.length) * 100)}%</span>
             </div>
             <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
               <div style={{width: `${(runResults.filter(r => r.status === 'PASS').length / runCases.length)*100}%`}} className="bg-green-500"/>
               <div style={{width: `${(runResults.filter(r => r.status === 'FAIL').length / runCases.length)*100}%`}} className="bg-red-500"/>
             </div>
           </div>
           <div className="flex-1 overflow-y-auto">
             {runCases.map(c => {
               const res = runResults.find(r => r.caseId === c.id);
               const st = res?.status || 'UNTESTED';
               let color = 'bg-gray-200';
               if(st === 'PASS') color = 'bg-green-500';
               if(st === 'FAIL') color = 'bg-red-500';
               if(st === 'BLOCK') color = 'bg-gray-800';
               if(st === 'NA') color = 'bg-yellow-500';

               return (
                 <div 
                   key={c.id} 
                   onClick={() => setActiveCase(c)}
                   className={`p-3 border-b cursor-pointer hover:bg-white flex items-center gap-3 ${activeCase?.id === c.id ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
                 >
                   <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
                   <div className="text-sm truncate font-medium text-gray-700">{c.title}</div>
                 </div>
               )
             })}
           </div>
        </div>
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
           {activeCase ? (
             <div className="max-w-4xl mx-auto w-full">
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className="text-2xl font-bold mb-1">{activeCase.title}</h2>
                   <div className="text-sm text-gray-500">Case ID: {activeCase.id}</div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => handleResultSubmit('PASS')} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold shadow-sm">PASS & NEXT</button>
                    <button onClick={() => handleResultSubmit('FAIL')} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold">FAIL</button>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-8">
                 <div className="col-span-2 space-y-6">
                    <div className="bg-blue-50 p-4 rounded border border-blue-100">
                      <h4 className="font-bold text-sm text-blue-800 mb-2">Preconditions</h4>
                      <p className="whitespace-pre-wrap text-sm">{activeCase.precondition || 'None'}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-4">Steps</h4>
                      <div className="space-y-4">
                        {activeCase.steps.map((s, idx) => (
                          <div key={idx} className="flex gap-4 p-4 border rounded bg-gray-50">
                             <div className="font-bold text-gray-400">{idx+1}</div>
                             <div className="flex-1 grid grid-cols-2 gap-4">
                                <div><div className="text-xs font-bold text-gray-500 uppercase mb-1">Action</div>{s.step}</div>
                                <div><div className="text-xs font-bold text-gray-500 uppercase mb-1">Expected</div>{s.expected}</div>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="border rounded-lg p-4 bg-white shadow-sm">
                       <h4 className="font-bold mb-4">Result Entry</h4>
                       <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                            <select 
                              className="w-full border rounded p-2 font-bold"
                              value={status}
                              onChange={e => setStatus(e.target.value as TestStatus)}
                            >
                              <option value="UNTESTED">Untested</option>
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                              <option value="BLOCK">BLOCKED</option>
                              <option value="NA">N/A</option>
                            </select>
                          </div>
                          <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">Comment / Actual Result</label>
                             <textarea 
                               className="w-full border rounded p-2 h-32" 
                               placeholder="Enter actual result details..."
                               value={comment}
                               onChange={e => setComment(e.target.value)}
                             />
                          </div>
                          <button onClick={() => handleResultSubmit(status)} className="w-full py-2 bg-primary text-white rounded font-bold hover:bg-blue-600">
                            Save Result
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-center h-full text-gray-400">Select a case to execute</div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
       <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">테스트 실행 (Runs)</h1>
          <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-primary text-white rounded font-bold flex items-center gap-2">
            <Plus size={20}/> 실행 계획 생성
          </button>
       </div>
       <div className="grid gap-4">
         {runs.map(r => (
           <div key={r.id} onClick={() => setSelectedRun(r)} className="bg-white p-6 rounded-lg shadow-sm border hover:border-primary cursor-pointer">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-lg text-primary">{r.title}</h3>
                 <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                 <span className="flex items-center gap-1"><List size={16}/> {r.caseIds.length} Cases</span>
                 <span className="flex items-center gap-1"><Users size={16}/> Unassigned</span>
              </div>
           </div>
         ))}
       </div>
       <RunCreationModal 
         isOpen={isCreateOpen} 
         onClose={() => setCreateOpen(false)} 
         project={project} 
         onSubmit={async (title, ids) => { await RunService.create({ projectId: project.id, title, caseIds: ids }); loadRuns(); }}
       />
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'CASES' | 'RUNS' | 'SETTINGS'>('DASHBOARD');
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  useEffect(() => {
    // Initial Load
    const u = AuthService.getCurrentUser();
    setUser(u);
    AuthService.getAllUsers().then(setUsers);
    loadProjects();
  }, []);

  const loadProjects = () => ProjectService.getAll().then(setProjects);

  const login = async (email: string) => {
    const u = await AuthService.login(email);
    setUser(u);
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    setCurrentProject(null);
  };

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, login, logout, users }}>
        <LoginScreen />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, users }}>
      <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-lg text-blue-400 mb-6">
              <CheckCircle className="text-blue-500" /> QA Manager
            </div>
            
            {/* Project Switcher */}
            <div className="relative group">
              <button 
                onClick={() => setCurrentProject(null)}
                className="w-full text-left p-2 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition"
              >
                <div className="truncate font-semibold">
                  {currentProject ? currentProject.title : '프로젝트 선택...'}
                </div>
                <ChevronDown size={16} className="text-slate-400"/>
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {currentProject ? (
              <>
                <button onClick={() => setView('DASHBOARD')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${view === 'DASHBOARD' ? 'bg-primary text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <LayoutDashboard size={20} /> 대시보드
                </button>
                <button onClick={() => setView('CASES')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${view === 'CASES' ? 'bg-primary text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <FolderTree size={20} /> 테스트 케이스
                </button>
                <button onClick={() => setView('RUNS')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition ${view === 'RUNS' ? 'bg-primary text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <PlayCircle size={20} /> 테스트 실행
                </button>
              </>
            ) : (
              <div className="text-slate-500 text-sm px-4 py-8 text-center">
                프로젝트를 선택하거나 생성하여 작업을 시작하세요.
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-bold truncate">{user.name}</div>
                <div className="text-xs text-slate-400 truncate">{user.email}</div>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center gap-2 text-slate-400 hover:text-white px-2 py-1 text-sm hover:bg-slate-800 rounded">
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {!currentProject ? (
            <ProjectList 
              projects={projects} 
              onSelect={setCurrentProject} 
              onCreate={() => setProjectModalOpen(true)} 
            />
          ) : (
            <>
               {view === 'DASHBOARD' && <Dashboard project={currentProject} />}
               {view === 'CASES' && <TestCaseManager project={currentProject} />}
               {view === 'RUNS' && <TestRunManager project={currentProject} />}
            </>
          )}
        </div>
        
        <ProjectModal 
          isOpen={isProjectModalOpen} 
          onClose={() => setProjectModalOpen(false)} 
          onSubmit={async (t, d, s) => { await ProjectService.create({ title: t, description: d, status: s }); loadProjects(); }} 
        />
      </div>
    </AuthContext.Provider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);