import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Layout, LayoutDashboard, FolderTree, PlayCircle, Settings, Users, LogOut, 
  Plus, ChevronRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Clock, Save, History, Search, Filter,
  Download, Upload, FileText, AlertTriangle, ArrowRightLeft, ArrowRight
} from 'lucide-react';
import { 
  AuthService, ProjectService, TestCaseService, RunService, HistoryService 
} from './storage';
import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, TestStep, Role, TestStatus 
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
  const v = val.toUpperCase().trim();
  if (['HIGH', 'H', '상', 'A', '1', 'URGENT'].includes(v)) return 'HIGH';
  if (['LOW', 'L', '하', 'C', '3'].includes(v)) return 'LOW';
  return 'MEDIUM'; // Default to Medium for 'MEDIUM', 'M', '중', 'B', '2', or unknown
};

const normalizeType = (val: string): 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY' => {
  const v = val.toUpperCase().trim();
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

// Import Modal Component with Column Mapping
const ImportExportModal = ({ 
  isOpen, onClose, project, cases, sections, onImportSuccess 
}: { 
  isOpen: boolean, onClose: () => void, project: Project, cases: TestCase[], sections: Section[], onImportSuccess: () => void 
}) => {
  const { user } = useContext(AuthContext);
  const [mode, setMode] = useState<'SELECT' | 'MAPPING' | 'PREVIEW'>('SELECT');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  
  // Mapping State: Internal Field Key -> CSV Column Index
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const INTERNAL_FIELDS = [
    { key: 'section', label: '섹션 (Section/Folder)', required: false },
    { key: 'title', label: '케이스 제목 (Title)', required: true },
    { key: 'priority', label: '우선순위 (Priority)', required: false },
    { key: 'type', label: '유형 (Type)', required: false },
    { key: 'precondition', label: '사전 조건 (Precondition)', required: false },
    { key: 'step', label: '수행 절차 (Step)', required: false },
    { key: 'expected', label: '기대 결과 (Expected Result)', required: false },
  ];

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      
      if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
             const mapped = json.map(c => ({
               ...c,
               sectionTitle: sections.find(s => s.id === c.sectionId)?.title || 'Imported JSON'
             }));
             setImportData(mapped);
             setMode('PREVIEW');
          } else {
             alert("잘못된 JSON 형식입니다.");
          }
        } catch (err) { alert("JSON 파싱 오류"); }
        return;
      } 
      
      // CSV Logic
      const rows = parseCSV(text);
      if (rows.length < 2) {
        alert("데이터가 없는 CSV 파일입니다.");
        return;
      }

      const headers = rows[0];
      setCsvHeaders(headers);
      setRawRows(rows.slice(1)); // Remove header row

      // Smart Auto-Mapping
      const initialMapping: Record<string, number> = {};
      headers.forEach((h, idx) => {
        const header = h.toLowerCase().replace(/\s/g, '');
        if (header.includes('section') || header.includes('섹션') || header.includes('depth')) initialMapping['section'] = idx; // Pick last one matches
        if (header.includes('title') || header.includes('제목')) initialMapping['title'] = idx;
        if (header.includes('priority') || header.includes('중요') || header.includes('우선')) initialMapping['priority'] = idx;
        if (header.includes('type') || header.includes('유형') || header.includes('구분')) initialMapping['type'] = idx;
        if (header.includes('pre') || header.includes('사전')) initialMapping['precondition'] = idx;
        if (header.includes('step') || header.includes('절차') || header.includes('방법')) initialMapping['step'] = idx;
        if (header.includes('expect') || header.includes('기대') || header.includes('예상')) initialMapping['expected'] = idx;
      });
      setColumnMapping(initialMapping);
      setMode('MAPPING');
    };
    reader.readAsText(file);
  };

  const processMapping = () => {
    // Validate required fields
    if (columnMapping['title'] === undefined) {
      alert("'케이스 제목' 컬럼은 반드시 매핑해야 합니다.");
      return;
    }

    const parsedCases: any[] = [];
    const errors: string[] = [];
    let currentCase: any = null;

    rawRows.forEach((row, idx) => {
      // Empty row check
      if (row.length === 0 || (row.length === 1 && !row[0])) return;

      const getVal = (key: string) => {
        const colIdx = columnMapping[key];
        return colIdx !== undefined && row[colIdx] ? row[colIdx].trim() : '';
      };

      const title = getVal('title');
      const step = getVal('step');
      const expected = getVal('expected');
      
      if (title) {
        // New Case
        if (currentCase) parsedCases.push(currentCase);

        // Normalize Values
        const rawPriority = getVal('priority');
        const rawType = getVal('type');

        currentCase = {
          sectionTitle: getVal('section') || 'Uncategorized',
          title: title,
          priority: rawPriority ? normalizePriority(rawPriority) : 'MEDIUM',
          type: rawType ? normalizeType(rawType) : 'FUNCTIONAL',
          precondition: getVal('precondition'),
          steps: []
        };
        
        if (step || expected) {
          currentCase.steps.push({ id: Date.now() + idx, step, expected });
        }
      } else {
        // Append Step to previous case (if merged cell style)
        if (currentCase) {
          if (step || expected) {
            currentCase.steps.push({ id: Date.now() + idx, step, expected });
          }
        } else {
          // Orphan row? Ignore or log warning.
          // errors.push(`Row ${idx + 2}: 제목이 없고 이전 케이스도 없어 스킵되었습니다.`);
        }
      }
    });
    
    if (currentCase) parsedCases.push(currentCase);

    if (parsedCases.length === 0) {
      alert("매핑 결과 유효한 케이스를 찾지 못했습니다. 매핑을 확인해주세요.");
      return;
    }

    setImportData(parsedCases);
    setImportErrors(errors);
    setMode('PREVIEW');
  };

  const executeImport = () => {
    if (!user) return;
    TestCaseService.importCases(project.id, importData, user);
    onImportSuccess();
    onClose();
    // Reset
    setMode('SELECT');
    setImportData([]);
    setImportErrors([]);
    setRawRows([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-bold text-lg">데이터 가져오기 / 내보내기</h3>
          <button onClick={onClose}><XCircle size={20} /></button>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          {mode === 'SELECT' && (
            <div className="grid grid-cols-2 gap-8 h-full">
              {/* Export */}
              <div className="border rounded-lg p-6 hover:shadow-md transition flex flex-col items-center justify-center space-y-4">
                <div className="bg-blue-100 p-4 rounded-full text-primary"><Download size={48} /></div>
                <h4 className="text-xl font-bold">내보내기 (Export)</h4>
                <div className="flex gap-2 w-full mt-4">
                  <button onClick={() => exportToCSV(cases, sections)} className="flex-1 py-2 border rounded hover:bg-gray-50 font-medium">CSV (Excel)</button>
                  <button onClick={() => exportToJSON(cases)} className="flex-1 py-2 border rounded hover:bg-gray-50 font-medium">JSON (Backup)</button>
                </div>
              </div>
              {/* Import */}
              <div className="border rounded-lg p-6 hover:shadow-md transition flex flex-col items-center justify-center space-y-4">
                <div className="bg-green-100 p-4 rounded-full text-green-600"><Upload size={48} /></div>
                <h4 className="text-xl font-bold">가져오기 (Import)</h4>
                <p className="text-center text-gray-500 text-sm">업로드 시 컬럼 매핑을 통해<br/>다양한 양식을 지원합니다.</p>
                <input 
                  type="file" accept=".csv,.json" ref={fileInputRef} className="hidden"
                  onChange={handleFileUpload}
                />
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-primary text-white rounded hover:bg-blue-600 font-medium mt-4">파일 선택</button>
              </div>
            </div>
          )}

          {mode === 'MAPPING' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setMode('SELECT')} className="text-gray-500 hover:text-gray-900">&larr; 다시 선택</button>
                <h3 className="text-xl font-bold">CSV 컬럼 매핑</h3>
              </div>
              
              <div className="bg-blue-50 p-4 rounded text-sm text-blue-800 mb-4">
                <p>업로드한 파일의 헤더와 앱의 필드를 연결해주세요. 내용이 비어있는 행은 이전 케이스의 Step으로 자동 병합됩니다.</p>
                <p className="mt-1 font-semibold">* 중요도 자동 보정: '상', 'High', 'A' 등은 자동으로 'HIGH'로 변환됩니다.</p>
              </div>

              <div className="grid gap-4 max-w-2xl mx-auto">
                {INTERNAL_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between border-b pb-2">
                    <div className="w-1/3">
                      <span className="font-semibold text-gray-700">{field.label}</span>
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div className="w-1/2">
                      <select 
                        className={`w-full p-2 border rounded ${columnMapping[field.key] === undefined && field.required ? 'border-red-300 bg-red-50' : ''}`}
                        value={columnMapping[field.key] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumnMapping(prev => ({
                            ...prev,
                            [field.key]: val === '' ? undefined : Number(val)
                          } as any));
                        }}
                      >
                        <option value="">(매핑 안 함)</option>
                        {csvHeaders.map((header, idx) => (
                          <option key={idx} value={idx}>{header} (Column {idx+1})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-6">
                <button 
                  onClick={processMapping}
                  className="px-6 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 flex items-center gap-2"
                >
                   매핑 완료 및 미리보기 <ArrowRightLeft size={16} />
                </button>
              </div>
            </div>
          )}

          {mode === 'PREVIEW' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-green-50 p-4 rounded text-green-800">
                <CheckCircle size={24} />
                <div>
                  <h4 className="font-bold text-lg">데이터 변환 성공</h4>
                  <p className="text-sm">총 {importData.length}개의 케이스가 생성될 예정입니다. 확인 후 최종 확정해주세요.</p>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
                   <AlertTriangle className="inline mr-2" size={16}/> 일부 데이터 경고: {importErrors.length}건 (무시 가능)
                </div>
              )}

              <div className="border rounded h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-32">Section</th>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-left w-20">Priority</th>
                      <th className="p-2 text-left w-24">Type</th>
                      <th className="p-2 text-left w-24">Steps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importData.map((d, i) => (
                      <tr key={i}>
                        <td className="p-2 truncate max-w-[150px]" title={d.sectionTitle}>{d.sectionTitle}</td>
                        <td className="p-2 font-medium">{d.title}</td>
                        <td className="p-2">
                           <span className={`px-1 rounded text-xs ${d.priority==='HIGH'?'bg-red-100 text-red-700': d.priority==='LOW'?'bg-green-100 text-green-700':'bg-gray-100'}`}>{d.priority}</span>
                        </td>
                        <td className="p-2">{d.type}</td>
                        <td className="p-2 text-gray-500">{d.steps.length} steps</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => { setMode('MAPPING'); }} className="px-4 py-2 border rounded hover:bg-gray-50">매핑 수정</button>
                <button 
                  onClick={executeImport} 
                  className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 flex items-center gap-2"
                >
                  <Save size={18} /> 저장하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// 2. Dashboard Component
const Dashboard = ({ project }: { project: Project }) => {
  const [stats, setStats] = useState({ total: 0, automated: 0, runs: 0, passRate: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Calculate mock stats
    const cases = TestCaseService.getCases(project.id);
    const runs = RunService.getAll(project.id);
    setStats({
      total: cases.length,
      automated: 0,
      runs: runs.length,
      passRate: 75 // Mock
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
      <h2 className="text-2xl font-bold text-gray-800">대시보드: {project.title}</h2>
      
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
    </div>
  );
};

// 3. Test Case Management
const TestCaseManager = ({ project }: { project: Project }) => {
  const { user } = useContext(AuthContext);
  const [sections, setSections] = useState<Section[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<TestCase>>({});
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);

  useEffect(() => {
    loadData();
  }, [project]);

  const loadData = () => {
    setSections(TestCaseService.getSections(project.id));
    setCases(TestCaseService.getCases(project.id));
  };

  const handleCreateSection = () => {
    const name = prompt("새 섹션(폴더) 이름을 입력하세요:");
    if (name) {
      TestCaseService.createSection({ projectId: project.id, title: name });
      loadData();
    }
  };

  const handleSelectCase = (tc: TestCase) => {
    setSelectedCase(tc);
    setIsEditing(false);
    setHistoryLogs(HistoryService.getLogs(tc.id));
  };

  const handleCreateCase = () => {
    if (!selectedSectionId) {
      alert("먼저 섹션을 선택해주세요.");
      return;
    }
    const newCase: Partial<TestCase> = {
      sectionId: selectedSectionId,
      projectId: project.id,
      title: '새 테스트 케이스',
      priority: 'MEDIUM',
      type: 'FUNCTIONAL',
      steps: [{ id: '1', step: '', expected: '' }],
      authorId: user?.id
    };
    setFormData(newCase);
    setSelectedCase(null);
    setIsEditing(true);
  };

  const handleEditCase = () => {
    if (!selectedCase) return;
    // Auth Check
    if (user?.role === 'EXTERNAL') return;
    if (user?.role === 'INTERNAL' && selectedCase.authorId !== user.id) {
      alert("본인이 작성한 케이스만 수정할 수 있습니다.");
      return;
    }
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

  const filteredCases = selectedSectionId 
    ? cases.filter(c => c.sectionId === selectedSectionId) 
    : cases;

  return (
    <>
      <div className="flex h-full border-t">
        {/* Sidebar: Sections */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FolderTree size={16} /> 섹션 (폴더)
            </h3>
            {user?.role !== 'EXTERNAL' && (
              <button onClick={handleCreateSection} className="text-primary hover:bg-blue-100 p-1 rounded" title="새 섹션 추가">
                <Plus size={16} />
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div 
              className={`cursor-pointer p-2 rounded text-sm ${selectedSectionId === null ? 'bg-blue-100 text-primary' : 'hover:bg-gray-200'}`}
              onClick={() => setSelectedSectionId(null)}
            >
              전체 케이스 보기
            </div>
            {sections.map(sec => (
              <div 
                key={sec.id}
                className={`cursor-pointer p-2 rounded text-sm flex items-center gap-2 ${selectedSectionId === sec.id ? 'bg-blue-100 text-primary' : 'hover:bg-gray-200'}`}
                onClick={() => setSelectedSectionId(sec.id)}
              >
                <FolderTree size={14} className="text-gray-400" />
                {sec.title}
              </div>
            ))}
          </div>
        </div>

        {/* List: Cases */}
        <div className="w-1/3 border-r bg-white overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">{filteredCases.length}개의 케이스</h3>
            <div className="flex gap-2">
              {user?.role !== 'EXTERNAL' && (
                <>
                  <button onClick={() => setImportModalOpen(true)} className="px-2 py-1 border rounded text-xs hover:bg-gray-50 flex items-center gap-1">
                    <Download size={12} className="rotate-180" /> 가져오기/내보내기
                  </button>
                  <button onClick={handleCreateCase} className="bg-primary text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                    <Plus size={14} /> 신규 생성
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="divide-y">
            {filteredCases.map(tc => (
              <div 
                key={tc.id} 
                className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedCase?.id === tc.id ? 'border-l-4 border-primary bg-blue-50' : ''}`}
                onClick={() => handleSelectCase(tc)}
              >
                <div className="font-medium text-sm text-gray-900">{tc.title}</div>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tc.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tc.priority}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{tc.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail: View/Edit */}
        <div className="flex-1 bg-white p-6 overflow-y-auto">
          {isEditing ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">케이스 수정</h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 border rounded hover:bg-gray-50">취소</button>
                  <button onClick={handleSave} className="px-3 py-1 bg-primary text-white rounded hover:bg-blue-600 flex items-center gap-1">
                    <Save size={14} /> 저장
                  </button>
                </div>
              </div>
              
              <input 
                className="w-full text-lg font-semibold p-2 border rounded" 
                placeholder="케이스 제목 입력"
                value={formData.title || ''}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">우선순위 (Priority)</label>
                  <select 
                    className="mt-1 block w-full p-2 border rounded"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                  >
                    <option value="LOW">Low (낮음)</option>
                    <option value="MEDIUM">Medium (중간)</option>
                    <option value="HIGH">High (높음)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">유형 (Type)</label>
                  <select 
                    className="mt-1 block w-full p-2 border rounded"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="FUNCTIONAL">Functional (기능)</option>
                    <option value="UI">UI (화면)</option>
                    <option value="PERFORMANCE">Performance (성능)</option>
                    <option value="SECURITY">Security (보안)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사전 조건 (Markdown 지원)</label>
                <textarea 
                  className="w-full p-2 border rounded h-20" 
                  value={formData.precondition || ''}
                  onChange={e => setFormData({ ...formData, precondition: e.target.value })}
                  placeholder="테스트 시작 전 필요한 조건들을 적어주세요."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">테스트 단계 및 기대 결과</label>
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 w-10">#</th>
                      <th className="border p-2">수행 절차 (Step)</th>
                      <th className="border p-2">기대 결과 (Expected)</th>
                      <th className="border p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.steps || []).map((step, idx) => (
                      <tr key={idx}>
                        <td className="border p-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="border p-0">
                          <textarea 
                            className="w-full h-full p-2 resize-none outline-none" 
                            rows={2}
                            value={step.step}
                            onChange={e => {
                              const newSteps = [...(formData.steps || [])];
                              newSteps[idx].step = e.target.value;
                              setFormData({ ...formData, steps: newSteps });
                            }}
                          />
                        </td>
                        <td className="border p-0">
                          <textarea 
                            className="w-full h-full p-2 resize-none outline-none" 
                            rows={2}
                            value={step.expected}
                            onChange={e => {
                              const newSteps = [...(formData.steps || [])];
                              newSteps[idx].expected = e.target.value;
                              setFormData({ ...formData, steps: newSteps });
                            }}
                          />
                        </td>
                        <td className="border p-2 text-center">
                          <button 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              const newSteps = [...(formData.steps || [])].filter((_, i) => i !== idx);
                              setFormData({ ...formData, steps: newSteps });
                            }}
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button 
                  className="mt-2 text-primary hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  onClick={() => setFormData({ ...formData, steps: [...(formData.steps || []), { id: Date.now().toString(), step: '', expected: '' }] })}
                >
                  <Plus size={14} /> 단계 추가 (Add Step)
                </button>
              </div>

            </div>
          ) : selectedCase ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCase.title}</h2>
                  <div className="text-sm text-gray-500 mt-1">
                    ID: {selectedCase.id} • 작성자: User {selectedCase.authorId}
                  </div>
                </div>
                {user?.role !== 'EXTERNAL' && (
                  <button 
                    onClick={handleEditCase} 
                    className={`px-3 py-1 border rounded text-sm ${user?.role === 'INTERNAL' && selectedCase.authorId !== user.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    title={user?.role === 'INTERNAL' && selectedCase.authorId !== user.id ? "작성자만 수정할 수 있습니다" : "수정하기"}
                  >
                    수정하기
                  </button>
                )}
              </div>

              <div className="flex gap-4">
                 <div className="bg-gray-100 px-3 py-1 rounded text-sm">
                   <span className="font-semibold text-gray-600 mr-2">우선순위:</span> 
                   {selectedCase.priority}
                 </div>
                 <div className="bg-gray-100 px-3 py-1 rounded text-sm">
                   <span className="font-semibold text-gray-600 mr-2">유형:</span> 
                   {selectedCase.type}
                 </div>
              </div>

              {selectedCase.precondition && (
                 <div>
                    <h3 className="font-semibold text-gray-700 mb-2">사전 조건 (Preconditions)</h3>
                    <div className="p-3 bg-yellow-50 border border-yellow-100 rounded text-gray-700 whitespace-pre-wrap">
                      {selectedCase.precondition}
                    </div>
                 </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">테스트 절차 (Test Steps)</h3>
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="border p-2 w-12">#</th>
                      <th className="border p-2">수행 절차 (Action)</th>
                      <th className="border p-2">기대 결과 (Expected Result)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCase.steps.map((step, idx) => (
                      <tr key={idx}>
                        <td className="border p-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="border p-2 whitespace-pre-wrap">{step.step}</td>
                        <td className="border p-2 whitespace-pre-wrap">{step.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-6 border-t">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <History size={16} /> 변경 이력 (History Log)
                </h3>
                <div className="space-y-4">
                  {historyLogs.length === 0 ? (
                    <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
                  ) : (
                    historyLogs.map(log => (
                      <div key={log.id} className="text-sm border-l-2 border-gray-300 pl-3">
                        <div className="flex justify-between text-gray-500">
                          <span><span className="font-semibold text-gray-700">{log.modifierName}</span> 님이 {log.action === 'CREATE' ? '생성함' : log.action === 'UPDATE' ? '수정함' : '삭제함'}</span>
                          <span>{new Date(log.timestamp).toLocaleString('ko-KR')}</span>
                        </div>
                        <ul className="mt-1 list-disc list-inside text-gray-600">
                          {log.changes.map((c, i) => (
                             <li key={i}>
                               <b>{c.field}</b> 변경: <span className="line-through text-gray-400">{JSON.stringify(c.oldVal)}</span> &rarr; <span className="text-green-600">{JSON.stringify(c.newVal)}</span>
                             </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <FolderTree size={48} className="mb-4" />
              <p>상세 내용을 보려면 케이스를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
      
      <ImportExportModal 
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        project={project}
        cases={cases}
        sections={sections}
        onImportSuccess={() => { loadData(); }}
      />
    </>
  );
};

// 4. Test Runner
const TestRunner = ({ project }: { project: Project }) => {
  const { user } = useContext(AuthContext);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);
  const [casesInRun, setCasesInRun] = useState<TestCase[]>([]);
  const [selectedResultCase, setSelectedResultCase] = useState<TestCase | null>(null);

  useEffect(() => {
    setRuns(RunService.getAll(project.id));
  }, [project]);

  const handleCreateRun = () => {
    if (user?.role === 'EXTERNAL') return;
    const title = prompt("실행 계획(Run) 제목을 입력하세요 (예: 5월 정기 배포 회귀 테스트):");
    if (!title) return;
    
    // For MVP, add ALL cases in project
    const allCases = TestCaseService.getCases(project.id);
    const newRun = RunService.create({
      projectId: project.id,
      title,
      status: 'OPEN',
      assignedToId: user?.id,
      caseIds: allCases.map(c => c.id)
    });
    setRuns([...runs, newRun]);
  };

  const handleOpenRun = (run: TestRun) => {
    setActiveRun(run);
    setRunResults(RunService.getResults(run.id));
    // Fetch cases involved
    const allCases = TestCaseService.getCases(project.id);
    const included = allCases.filter(c => run.caseIds.includes(c.id));
    setCasesInRun(included);
  };

  const submitResult = (status: TestStatus) => {
    if (!selectedResultCase || !activeRun || !user) return;
    const actual = (document.getElementById('actual-res') as HTMLTextAreaElement).value;
    const comment = (document.getElementById('comment-res') as HTMLTextAreaElement).value;

    RunService.saveResult({
      runId: activeRun.id,
      caseId: selectedResultCase.id,
      status,
      actualResult: actual,
      comment: comment,
      testerId: user.id
    });

    // Refresh results
    setRunResults(RunService.getResults(activeRun.id));
    setSelectedResultCase(null); // Close modal
  };

  const getStatusColor = (status?: string) => {
    switch(status) {
      case 'PASS': return 'bg-green-100 text-green-700';
      case 'FAIL': return 'bg-red-100 text-red-700';
      case 'BLOCK': return 'bg-gray-800 text-white';
      case 'RETEST': return 'bg-yellow-100 text-yellow-700';
      case 'NA': return 'bg-gray-200 text-gray-500';
      default: return 'bg-white border text-gray-500';
    }
  };

  if (activeRun) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setActiveRun(null)} className="text-gray-500 hover:text-gray-900">&larr; 뒤로가기</button>
          <h2 className="text-2xl font-bold">{activeRun.title}</h2>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">{activeRun.status}</span>
        </div>

        <div className="bg-white rounded shadow overflow-hidden flex-1 flex flex-col">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left w-20">ID</th>
                <th className="p-3 text-left">제목</th>
                <th className="p-3 text-left w-24">우선순위</th>
                <th className="p-3 text-left w-32">상태</th>
                <th className="p-3 text-center w-24">실행</th>
              </tr>
            </thead>
            <tbody className="divide-y overflow-y-auto">
              {casesInRun.map(tc => {
                const result = runResults.find(r => r.caseId === tc.id);
                return (
                  <tr key={tc.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500 text-sm">{tc.id.substring(0,6)}</td>
                    <td className="p-3 font-medium">{tc.title}</td>
                    <td className="p-3 text-sm">{tc.priority}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(result?.status)}`}>
                        {result?.status || 'UNTESTED'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => setSelectedResultCase(tc)}
                        className="text-primary hover:underline text-sm"
                      >
                        {result ? '재실행' : '실행'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Execution Modal */}
        {selectedResultCase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-2/3 h-3/4 flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <h3 className="font-bold text-lg">{selectedResultCase.title}</h3>
                <button onClick={() => setSelectedResultCase(null)}><XCircle size={20} /></button>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto flex gap-6">
                <div className="w-1/2 space-y-4">
                  <h4 className="font-semibold text-gray-700">테스트 가이드</h4>
                  <div className="space-y-4">
                    {selectedResultCase.precondition && (
                      <div className="p-3 bg-yellow-50 text-sm border-l-4 border-yellow-400">
                        {selectedResultCase.precondition}
                      </div>
                    )}
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-50"><th className="p-2 border">절차 (Step)</th><th className="p-2 border">기대 결과 (Expected)</th></tr>
                      </thead>
                      <tbody>
                        {selectedResultCase.steps.map((s, i) => (
                          <tr key={i}>
                            <td className="p-2 border">{s.step}</td>
                            <td className="p-2 border">{s.expected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="w-1/2 space-y-4 border-l pl-6">
                   <h4 className="font-semibold text-gray-700">실행 결과 입력</h4>
                   <div>
                     <label className="block text-sm font-medium mb-1">실제 결과 (Actual Result)</label>
                     <textarea id="actual-res" className="w-full border rounded p-2 h-24" placeholder="실제 발생한 현상을 입력하세요." />
                   </div>
                   <div>
                     <label className="block text-sm font-medium mb-1">코멘트 (Comment)</label>
                     <textarea id="comment-res" className="w-full border rounded p-2 h-16" placeholder="비고 사항..." />
                   </div>
                   
                   <div className="grid grid-cols-3 gap-2 mt-6">
                     <button onClick={() => submitResult('PASS')} className="p-3 bg-green-600 text-white rounded font-bold hover:bg-green-700">성공 (PASS)</button>
                     <button onClick={() => submitResult('FAIL')} className="p-3 bg-red-600 text-white rounded font-bold hover:bg-red-700">실패 (FAIL)</button>
                     <button onClick={() => submitResult('BLOCK')} className="p-3 bg-gray-800 text-white rounded font-bold hover:bg-gray-900">차단됨 (BLOCK)</button>
                     <button onClick={() => submitResult('RETEST')} className="p-3 bg-yellow-500 text-white rounded font-bold hover:bg-yellow-600">재테스트 (RETEST)</button>
                     <button onClick={() => submitResult('NA')} className="p-3 bg-gray-300 text-gray-700 rounded font-bold hover:bg-gray-400">해당 없음 (N/A)</button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">테스트 실행 목록 (Runs)</h2>
        {user?.role !== 'EXTERNAL' && (
          <button onClick={handleCreateRun} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2">
            <Plus size={16} /> 새 실행 생성
          </button>
        )}
      </div>
      
      <div className="grid gap-4">
        {runs.map(run => (
          <div key={run.id} className="bg-white p-4 rounded shadow flex justify-between items-center hover:bg-gray-50 transition cursor-pointer" onClick={() => handleOpenRun(run)}>
            <div>
              <h3 className="font-bold text-lg">{run.title}</h3>
              <p className="text-sm text-gray-500">생성일: {new Date(run.createdAt).toLocaleDateString('ko-KR')} • {run.caseIds.length}개 케이스</p>
            </div>
            <div className="flex items-center gap-4">
               {/* Progress Bar Mock */}
               <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                 <div className="bg-green-500 h-full" style={{width: '60%'}}></div>
               </div>
               <ChevronRight className="text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. Admin User Management
const AdminPanel = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    setUsers(AuthService.getAllUsers());
  }, []);

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
           <thead className="bg-gray-50 border-b">
             <tr>
               <th className="p-3 text-left">이름</th>
               <th className="p-3 text-left">이메일</th>
               <th className="p-3 text-left">역할 (Role)</th>
               <th className="p-3 text-left">상태</th>
               <th className="p-3 text-left">작업</th>
             </tr>
           </thead>
           <tbody className="divide-y">
             {users.map(u => (
               <tr key={u.id}>
                 <td className="p-3 font-medium">{u.name}</td>
                 <td className="p-3 text-gray-500">{u.email}</td>
                 <td className="p-3">
                   <select 
                     value={u.role} 
                     onChange={(e) => changeRole(u, e.target.value as Role)}
                     className="border rounded p-1 text-sm"
                     disabled={u.id === user.id} // Cannot change own role
                   >
                     <option value="ADMIN">관리자 (Admin)</option>
                     <option value="INTERNAL">내부 QA (Internal)</option>
                     <option value="EXTERNAL">외부 인원 (External)</option>
                   </select>
                 </td>
                 <td className="p-3">
                   <span className={`px-2 py-1 rounded text-xs ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {u.status}
                   </span>
                 </td>
                 <td className="p-3">
                   {u.id !== user.id && (
                     <button 
                       onClick={() => toggleStatus(u)}
                       className="text-sm text-red-600 hover:underline"
                     >
                       {u.status === 'ACTIVE' ? '권한 회수 (차단)' : '권한 복구'}
                     </button>
                   )}
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'CASES' | 'RUNS' | 'ADMIN'>('DASHBOARD');

  // Load User from Session
  useEffect(() => {
    const loggedIn = AuthService.getCurrentUser();
    if (loggedIn) setUser(loggedIn);
    
    // Load default project
    const projects = ProjectService.getAll();
    if (projects.length > 0) setActiveProject(projects[0]);
  }, []);

  const login = (email: string) => {
    const u = AuthService.login(email);
    if (u) setUser(u);
    else alert("사용자를 찾을 수 없거나 비활성화된 계정입니다.");
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
  };

  if (!user) return <AuthContext.Provider value={{ user, login, logout }}><LoginScreen /></AuthContext.Provider>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <LayoutDashboard className="text-blue-500" /> Test Manager
            </h1>
            {activeProject && <div className="mt-2 text-xs bg-slate-800 p-2 rounded text-slate-400">프로젝트: {activeProject.title}</div>}
          </div>
          
          <nav className="flex-1 p-2 space-y-1">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <Layout size={18} /> 대시보드
            </button>
            <button onClick={() => setCurrentView('CASES')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'CASES' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <FolderTree size={18} /> 테스트 케이스
            </button>
            <button onClick={() => setCurrentView('RUNS')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'RUNS' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <PlayCircle size={18} /> 테스트 실행
            </button>
            {user.role === 'ADMIN' && (
              <button onClick={() => setCurrentView('ADMIN')} className={`w-full flex items-center gap-3 p-2 rounded ${currentView === 'ADMIN' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <Users size={18} /> 사용자 관리
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-medium text-white truncate">{user.name}</div>
                <div className="text-xs text-slate-500">{user.role}</div>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 bg-white border-b flex items-center px-6 justify-between">
            <div className="flex items-center gap-2 text-gray-500">
               <span>{activeProject?.title}</span>
               <ChevronRight size={16} />
               <span className="font-semibold text-gray-900 capitalize">
                 {currentView === 'DASHBOARD' && '대시보드'}
                 {currentView === 'CASES' && '테스트 케이스'}
                 {currentView === 'RUNS' && '테스트 실행'}
                 {currentView === 'ADMIN' && '사용자 관리'}
               </span>
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-auto">
             {!activeProject ? (
               <div className="p-10 text-center">활성화된 프로젝트가 없습니다.</div>
             ) : (
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
    </AuthContext.Provider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);