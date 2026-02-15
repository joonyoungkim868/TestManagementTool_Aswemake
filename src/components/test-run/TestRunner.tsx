import React, { useState, useEffect, useContext } from 'react';
import {
    PlayCircle, Trash2, ArrowLeft, ChevronUp, ChevronDown, BarChart2,
    AlertOctagon, ChevronLeft, ChevronRight, CheckCircle, Bug, RotateCcw, Loader2, FileText,
    Smartphone
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TestRun, TestResult, TestCase, TestStatus, Issue, ExecutionHistoryItem, DevicePlatform } from '../../types';
import { RunService, TestCaseService } from '../../storage';
import { AuthContext } from '../../context/AuthContext';
import { formatTextWithNumbers } from '../../utils/formatters';
import { LoadingSpinner } from '../common/Loading';
import { RunCreationModal } from './RunCreationModal';
import { ReportModal } from './ReportModal';
import { useLayout } from '../layout/MainLayout';
import { useSearchParams } from 'react-router-dom';

// UI용 타입 확장
interface TestCaseWithSection extends TestCase {
    sectionTitle?: string;
}

// -------------------------------------------------------------------------
// [Sub Component] Step 상태 선택 드롭다운
// -------------------------------------------------------------------------
const StatusDropdown = ({ 
    value, 
    onChange 
}: { 
    value: TestStatus, 
    onChange: (s: TestStatus) => void 
}) => {
    const getBgColor = (s: TestStatus) => {
        switch (s) {
            case 'PASS': return 'bg-green-100 text-green-700 border-green-200';
            case 'FAIL': return 'bg-red-100 text-red-700 border-red-200';
            case 'BLOCK': return 'bg-gray-800 text-white border-gray-900';
            case 'NA': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-white text-gray-400 border-gray-200';
        }
    };

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as TestStatus)}
            className={`h-8 text-xs font-bold rounded border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 cursor-pointer px-2 w-full transition-colors ${getBgColor(value)}`}
            onClick={(e) => e.stopPropagation()} 
        >
            <option value="UNTESTED" className="bg-white text-gray-500">Untested</option>
            <option value="PASS" className="bg-white text-green-600">PASS</option>
            <option value="FAIL" className="bg-white text-red-600">FAIL</option>
            <option value="BLOCK" className="bg-white text-gray-800">BLOCK</option>
            <option value="NA" className="bg-white text-orange-600">N/A</option>
        </select>
    );
};

// -------------------------------------------------------------------------
// [Sub Component] 하단 결과 입력 패널
// -------------------------------------------------------------------------
const BottomResultPane = ({
    platform,
    data,
    initialHistory,
    onUpdate,
    onSaveNext
}: {
    platform: DevicePlatform,
    data: Partial<TestResult>,
    initialHistory: ExecutionHistoryItem[],
    onUpdate: (field: keyof TestResult, value: any) => Promise<void>,
    onSaveNext: () => void
}) => {
    const status = data.status || 'UNTESTED';
    const actual = data.actualResult || '';
    const comment = data.comment || '';
    const defectLabel = data.issues?.[0]?.label || '';
    const defectUrl = data.issues?.[0]?.url || '';

    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePassAndNext = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const nextStatus = status === 'FAIL' ? 'FAIL' : 'PASS';
            await onUpdate('status', nextStatus);
            onSaveNext(); 
        } finally {
            setTimeout(() => setIsProcessing(false), 300);
        }
    };

    const getStatusColor = (s: TestStatus) => {
        switch (s) {
            case 'PASS': return 'bg-green-100 text-green-700 border-green-500';
            case 'FAIL': return 'bg-red-100 text-red-700 border-red-500';
            case 'BLOCK': return 'bg-gray-800 text-white border-gray-900';
            case 'NA': return 'bg-orange-100 text-orange-700 border-orange-500';
            default: return 'bg-gray-100 text-gray-500 border-gray-300';
        }
    };

    const fullHistoryTimeline = status === 'UNTESTED' ? [] : [
        {
            status,
            actualResult: actual,
            comment,
            testerId: data.testerId || 'unknown',
            timestamp: new Date().toISOString(),
            issues: (defectLabel && defectUrl) ? [{ id: 'temp', label: defectLabel, url: defectUrl }] : [],
            stepResults: data.stepResults,
            isCurrent: true
        },
        ...initialHistory.map(h => ({ ...h, isCurrent: false }))
    ];

    return (
        <div className={`flex flex-col h-full rounded-xl shadow-sm border-2 bg-white overflow-hidden ${getStatusColor(status).replace('text-', 'border-').split(' ')[2]}`}>
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                <div className="font-bold text-sm flex items-center gap-2">
                    {platform === 'iOS' && '🍎 iOS Result'}
                    {platform === 'Android' && '🤖 Android Result'}
                    {platform === 'PC' && '🖥️ WEB Result'}
                </div>
                <div className="flex gap-1 scale-90 origin-right">
                    {(['PASS', 'FAIL', 'BLOCK', 'NA'] as TestStatus[]).map(s => (
                        <button
                            key={s}
                            onClick={() => onUpdate('status', s)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${status === s ? getStatusColor(s) + ' shadow-sm' : 'text-gray-400 hover:bg-gray-200 bg-white border'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Actual Result</label>
                    <textarea
                        className="w-full border rounded p-2 text-sm h-20 resize-none focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="실제 결과..."
                        value={actual}
                        onChange={e => onUpdate('actualResult', e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Comment</label>
                    <input
                        className="w-full border rounded p-2 text-sm h-9 focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="코멘트..."
                        value={comment}
                        onChange={e => onUpdate('comment', e.target.value)}
                    />
                </div>

                {status === 'FAIL' && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 bg-red-50 p-2 rounded border border-red-100">
                        <div className="relative flex-1">
                            <Bug size={14} className="absolute left-2 top-2.5 text-red-400" />
                            <input
                                className="w-full border border-red-200 bg-white rounded pl-7 p-1.5 text-xs h-9 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500"
                                placeholder="Issue Key"
                                value={defectLabel}
                                onChange={e => {
                                    const newIssues = [{ id: 'temp', label: e.target.value, url: defectUrl }];
                                    onUpdate('issues', newIssues);
                                }}
                            />
                        </div>
                        <input
                            className="flex-[2] border border-red-200 bg-white rounded p-1.5 text-xs h-9 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500"
                            placeholder="Issue URL..."
                            value={defectUrl}
                            onChange={e => {
                                const newIssues = [{ id: 'temp', label: defectLabel, url: e.target.value }];
                                onUpdate('issues', newIssues);
                            }}
                        />
                    </div>
                )}
            </div>
            
            <div className="border-t bg-gray-50">
                <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="w-full flex justify-between items-center text-gray-400 font-bold hover:text-gray-600 p-2 text-[10px] border-b"
                >
                    <span className="flex items-center gap-2"><RotateCcw size={12} /> History</span>
                    {historyExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {historyExpanded && (
                    <div className="p-2 space-y-1 max-h-24 overflow-y-auto bg-white border-b">
                        {fullHistoryTimeline.length === 0 && <div className="text-center text-gray-300 text-[10px]">No history.</div>}
                        {fullHistoryTimeline.map((h, idx) => (
                            <div key={idx} className="flex gap-2 items-start text-[10px] text-gray-500">
                                <span className={`px-1 rounded font-bold ${h.status === 'PASS' ? 'bg-green-100 text-green-700' : h.status === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{h.status}</span>
                                <span className="truncate flex-1">{new Date(h.timestamp).toLocaleDateString()}</span>
                                {h.isCurrent && <span className="text-blue-500 font-bold">(Current)</span>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-3 flex justify-end">
                    <button
                        onClick={handlePassAndNext}
                        disabled={isProcessing}
                        className={`
                            px-4 py-1.5 text-xs font-bold rounded shadow flex items-center gap-1 transition-all duration-200
                            ${isProcessing ? 'bg-blue-400 cursor-not-allowed opacity-80' : 'bg-primary hover:bg-blue-700 active:scale-95 cursor-pointer'}
                            text-white
                        `}
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {status === 'FAIL' ? 'Save & Next' : 'Pass & Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// -------------------------------------------------------------------------
// [Main Component] Test Runner
// -------------------------------------------------------------------------
export const TestRunner = () => {
    const { activeProject, isLoading: isProjectLoading } = useLayout();
    const project = activeProject;
    const [searchParams, setSearchParams] = useSearchParams();

    const { user } = useContext(AuthContext);
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
    const [runResults, setRunResults] = useState<TestResult[]>([]);
    const [runCases, setRunCases] = useState<TestCaseWithSection[]>([]);
    const [activeCaseIndex, setActiveCaseIndex] = useState(0);
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [isReportOpen, setReportOpen] = useState(false);
    const [isDashboardOpen, setDashboardOpen] = useState(true);
    const [runStats, setRunStats] = useState<Record<string, TestResult[]>>({});

    // Lifted State
    const [pcResult, setPcResult] = useState<Partial<TestResult>>({});
    const [iosResult, setIosResult] = useState<Partial<TestResult>>({});
    const [aosResult, setAosResult] = useState<Partial<TestResult>>({});

    const [loading, setLoading] = useState(true);
    
    const loadRuns = async () => {
        if (!project) return;
        setLoading(true);
        try {
            const loadedRuns = await RunService.getAll(project.id);
            setRuns(loadedRuns);

            const stats: Record<string, TestResult[]> = {};
            await Promise.all(loadedRuns.map(async (r) => {
                stats[r.id] = await RunService.getResults(r.id);
            }));
            setRunStats(stats);

            const runIdParam = searchParams.get('runId');
            if (runIdParam) {
                const foundRun = loadedRuns.find(r => r.id === runIdParam);
                if (foundRun) {
                    setSelectedRun(foundRun);
                    const caseIdx = parseInt(searchParams.get('case') || '0');
                    if (!isNaN(caseIdx)) setActiveCaseIndex(caseIdx);
                }
            } else {
                setSelectedRun(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRuns();
    }, [project]);

    const updateUrl = (runId: string | null, caseIdx: number) => {
        const params = new URLSearchParams(searchParams);
        if (runId) {
            params.set('runId', runId);
            params.set('case', caseIdx.toString());
        } else {
            params.delete('runId');
            params.delete('case');
        }
        setSearchParams(params);
    };

    useEffect(() => {
        if (selectedRun && project) {
            Promise.all([
                TestCaseService.getCases(project.id),
                RunService.getResults(selectedRun.id),
                TestCaseService.getSections(project.id)
            ]).then(([allCases, results, sections]) => {
                const sectionMap = new Map(sections.map(s => [s.id, s.title]));
                const sortedAllCases = allCases.sort((a, b) => (a.seq_id || 0) - (b.seq_id || 0));
                const casesInRun = sortedAllCases
                    .filter(c => selectedRun.caseIds.includes(c.id))
                    .map(c => ({ ...c, sectionTitle: sectionMap.get(c.sectionId) }));

                setRunCases(casesInRun);
                setRunResults(results);

                let safeIndex = activeCaseIndex;
                if (safeIndex >= casesInRun.length) safeIndex = 0;
                setActiveCaseIndex(safeIndex);
            });
        }
    }, [selectedRun]);

    useEffect(() => {
        const activeCase = runCases[activeCaseIndex];
        if (!activeCase) return;

        const caseResults = runResults.filter(r => r.caseId === activeCase.id);
        
        const initResult = (platform: DevicePlatform) => {
            const found = caseResults.find(r => r.device_platform === platform) || caseResults.find(r => !r.device_platform && platform === 'PC');
            return found || { status: 'UNTESTED', stepResults: [], device_platform: platform };
        };

        setPcResult(initResult('PC'));
        setIosResult(initResult('iOS'));
        setAosResult(initResult('Android'));

    }, [activeCaseIndex, runResults, runCases]);

    // [버그 수정 1] 통합 업데이트 함수
    const handleResultUpdate = async (platform: DevicePlatform, field: keyof TestResult, value: any) => {
        if (!selectedRun || !runCases[activeCaseIndex]) return;
        const currentCase = runCases[activeCaseIndex];

        let targetState = platform === 'iOS' ? iosResult : platform === 'Android' ? aosResult : pcResult;
        const setTargetState = platform === 'iOS' ? setIosResult : platform === 'Android' ? setAosResult : setPcResult;

        const updatedResult = { ...targetState, [field]: value };
        setTargetState(updatedResult);

        const payload: Partial<TestResult> = {
            runId: selectedRun.id,
            caseId: currentCase.id,
            device_platform: platform,
            testerId: user?.id,
            ...updatedResult
        };
        
        await RunService.saveResult(payload);
        RunService.getResults(selectedRun.id).then(setRunResults);
    };

    const handleStepUpdate = async (platform: DevicePlatform, stepId: string, newStatus: TestStatus) => {
        if (!selectedRun || !runCases[activeCaseIndex]) return;
        const currentCase = runCases[activeCaseIndex];

        let targetState = platform === 'iOS' ? iosResult : platform === 'Android' ? aosResult : pcResult;
        const setTargetState = platform === 'iOS' ? setIosResult : platform === 'Android' ? setAosResult : setPcResult;

        const currentSteps = targetState.stepResults || [];
        
        // 1. 스텝 결과 업데이트 (기존 값 제거 후 추가)
        const updatedSteps = currentSteps.filter(s => s.stepId !== stepId);
        updatedSteps.push({ stepId, status: newStatus });

        // 2. 전체 상태 자동 계산 로직
        const totalSteps = currentCase.steps.length;
        // 'UNTESTED'가 아닌 유효한 결과만 필터링
        const validResults = updatedSteps.filter(s => s.status !== 'UNTESTED');
        
        let calculatedStatus: TestStatus = 'UNTESTED';

        const hasFail = validResults.some(s => s.status === 'FAIL');
        const hasBlock = validResults.some(s => s.status === 'BLOCK');
        const hasNA = validResults.some(s => s.status === 'NA'); // [변경] 하나라도 NA가 있는지 확인

        if (hasFail) {
            calculatedStatus = 'FAIL';
        } else if (hasBlock) {
            calculatedStatus = 'BLOCK';
        } else if (hasNA) {
            calculatedStatus = 'NA'; // [변경] FAIL/BLOCK이 없고 NA가 하나라도 있으면 전체 NA
        } else {
            // FAIL, BLOCK, NA가 없는 경우 (즉, PASS만 있거나 비어있음)
            if (validResults.length >= totalSteps) {
                // 모든 스텝이 수행되었고, 위 상태들이 없다면 => PASS
                calculatedStatus = 'PASS';
            } else {
                // 아직 수행되지 않은 스텝이 남았고, 특이사항(Fail/Block/NA)이 없음
                calculatedStatus = 'UNTESTED';
            }
        }

        // 상태 객체를 완성해서 한 번에 저장
        const updatedResult = { 
            ...targetState, 
            stepResults: updatedSteps, 
            status: calculatedStatus 
        };
        
        // UI 즉시 반영
        setTargetState(updatedResult);

        // DB 저장
        const payload: Partial<TestResult> = {
            runId: selectedRun.id,
            caseId: currentCase.id,
            device_platform: platform,
            testerId: user?.id,
            ...updatedResult
        };
        
        await RunService.saveResult(payload);
        RunService.getResults(selectedRun.id).then(setRunResults);
    };

    const handleNext = () => {
        if (activeCaseIndex < runCases.length - 1) {
            const idx = activeCaseIndex + 1;
            setActiveCaseIndex(idx);
            if (selectedRun) updateUrl(selectedRun.id, idx);
        }
    };

    const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("이 테스트 실행(Test Run)을 삭제하시겠습니까?\n포함된 모든 결과 데이터가 영구 삭제됩니다.")) {
            await RunService.delete(runId);
            loadRuns();
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

    const stats = getRunStats();

    if (isProjectLoading) return <LoadingSpinner />;
    if (!project) return <div className="p-8 text-center text-gray-500">프로젝트를 찾을 수 없습니다.</div>;

    if (!selectedRun) {
        if (loading) return <LoadingSpinner />;
        return (
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">테스트 실행 (Test Runs)</h2>
                    <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 flex items-center gap-2">
                        <PlayCircle size={18} /> 실행 계획 생성
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
                            <div key={run.id} className="bg-white p-4 rounded shadow border hover:border-primary cursor-pointer group" onClick={() => { setSelectedRun(run); updateUrl(run.id, 0); }}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-primary">{run.title}</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500">{new Date(run.createdAt).toLocaleDateString()}</span>
                                        <button onClick={(e) => handleDeleteRun(run.id, e)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden flex"><div className="bg-green-500 h-full" style={{ width: `${passWidth}%` }} /><div className="bg-red-500 h-full" style={{ width: `${failWidth}%` }} /></div>
                                    <span className="text-xs font-bold text-gray-500">{total} Cases</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <RunCreationModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} project={project} onSubmit={async (t, ids) => { await RunService.create({ projectId: project.id, title: t, caseIds: ids }); loadRuns(); }} />
            </div>
        );
    }

    if (runCases.length === 0) return <LoadingSpinner />;
    const activeCase = runCases[activeCaseIndex];
    if (!activeCase) return <div>Data Error</div>;

    const isAppMode = activeCase.platform_type === 'APP';

    return (
        <div className="flex flex-col h-full bg-gray-100">
            <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedRun(null); updateUrl(null, 0); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={24} /></button>
                    <div>
                        <h2 className="font-bold text-xl text-gray-900 leading-tight">{selectedRun.title}</h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <button onClick={() => setDashboardOpen(!isDashboardOpen)} className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-sm font-bold text-gray-700">
                                <span>{activeCaseIndex + 1} / {runCases.length}</span>
                                {isDashboardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1"></div>
                            <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(stats.pass / (stats.total || 1)) * 100}%` }} />
                                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(stats.fail / (stats.total || 1)) * 100}%` }} />
                                <div className="h-full bg-gray-800 transition-all duration-500" style={{ width: `${(stats.block / (stats.total || 1)) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
                <button onClick={() => setReportOpen(true)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-bold shadow-sm"><BarChart2 size={18} /> 리포트</button>
            </div>

            {isDashboardOpen && (
                <div className="bg-white border-b p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="max-w-6xl mx-auto flex gap-8 items-center justify-center">
                        <div className="h-32 w-32 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[{ name: 'Pass', value: stats.pass, fill: '#22c55e' }, { name: 'Fail', value: stats.fail, fill: '#ef4444' }, { name: 'Block', value: stats.block, fill: '#1f2937' }, { name: 'Untested', value: stats.untested, fill: '#e5e7eb' }]} innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value">
                                        <Cell fill="#22c55e" /><Cell fill="#ef4444" /><Cell fill="#1f2937" /><Cell fill="#e5e7eb" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-gray-600 text-xs">{Math.round((stats.pass / (stats.total || 1)) * 100)}%</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-3 bg-green-50 rounded border border-green-100 w-24 text-center"><div className="text-xs font-bold text-green-700">Pass</div><div className="text-xl font-bold text-green-800">{stats.pass}</div></div>
                            <div className="p-3 bg-red-50 rounded border border-red-100 w-24 text-center"><div className="text-xs font-bold text-red-700">Fail</div><div className="text-xl font-bold text-red-800">{stats.fail}</div></div>
                            <div className="p-3 bg-gray-100 rounded border border-gray-200 w-24 text-center"><div className="text-xs font-bold text-gray-700">Block</div><div className="text-xl font-bold text-gray-800">{stats.block}</div></div>
                            <div className="p-3 bg-white rounded border border-gray-200 w-24 text-center"><div className="text-xs font-bold text-gray-400">Untested</div><div className="text-xl font-bold text-gray-500">{stats.untested}</div></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* [버그 수정 2] 사이드바 리스트 렌더링 로직 수정 */}
                <div className="w-72 bg-white border-r overflow-y-auto hidden md:block">
                    {runCases.map((c, idx) => {
                        // 현재 루프의 케이스(c)에 해당하는 결과를 찾음 (전체 상태 사용 X)
                        const cPcRes = runResults.find(r => r.caseId === c.id && (!r.device_platform || r.device_platform === 'PC'));
                        const cIosRes = runResults.find(r => r.caseId === c.id && r.device_platform === 'iOS');
                        const cAosRes = runResults.find(r => r.caseId === c.id && r.device_platform === 'Android');

                        let status: TestStatus = 'UNTESTED';
                        if (c.platform_type === 'APP') {
                             if (cIosRes?.status === 'FAIL' || cAosRes?.status === 'FAIL') status = 'FAIL';
                             else if (cIosRes?.status === 'PASS' && cAosRes?.status === 'PASS') status = 'PASS';
                             else if (cIosRes?.status || cAosRes?.status) status = cIosRes?.status || cAosRes?.status || 'UNTESTED';
                        } else {
                             status = cPcRes?.status || 'UNTESTED';
                        }

                        return (
                            <div key={c.id} onClick={() => { setActiveCaseIndex(idx); updateUrl(selectedRun.id, idx); }} className={`p-3 border-b cursor-pointer flex items-center gap-2 text-sm hover:bg-gray-50 ${activeCaseIndex === idx ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}>
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status === 'PASS' ? 'bg-green-500' : status === 'FAIL' ? 'bg-red-500' : 'bg-gray-300'}`} />
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate">{c.title}</span>
                                    {c.platform_type === 'APP' && <span className="text-[10px] text-purple-500 flex items-center gap-1"><Smartphone size={10}/> APP</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 flex flex-col relative bg-gray-100 overflow-hidden">
                    <button onClick={() => { if(activeCaseIndex > 0) setActiveCaseIndex(activeCaseIndex - 1) }} disabled={activeCaseIndex === 0} className="absolute left-4 top-1/2 z-20 p-2 bg-white rounded-full shadow hover:text-primary disabled:opacity-0"><ChevronLeft size={24} /></button>
                    <button onClick={() => { if(activeCaseIndex < runCases.length - 1) setActiveCaseIndex(activeCaseIndex + 1) }} disabled={activeCaseIndex === runCases.length - 1} className="absolute right-4 top-1/2 z-20 p-2 bg-white rounded-full shadow hover:text-primary disabled:opacity-0"><ChevronRight size={24} /></button>

                    <div className="flex-1 overflow-y-auto px-12 py-6">
                        <div className="max-w-6xl mx-auto space-y-6">
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <div className="flex gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-600 border">{activeCase.sectionTitle || 'General'}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${activeCase.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{activeCase.priority}</span>
                                    {isAppMode && <span className="px-2 py-0.5 rounded text-xs font-bold border bg-purple-50 text-purple-600 border-purple-100 flex items-center gap-1"><Smartphone size={10}/> APP</span>}
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">{activeCase.title}</h1>
                                {activeCase.precondition && (
                                    <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200 whitespace-pre-wrap flex gap-2">
                                        <AlertOctagon size={16} className="mt-0.5 flex-shrink-0" />
                                        <div><strong>Precondition:</strong> {formatTextWithNumbers(activeCase.precondition)}</div>
                                    </div>
                                )}
                                {activeCase.note && (
                                    <div className="mt-2 bg-white p-3 rounded text-sm text-gray-700 border border-gray-200 shadow-sm whitespace-pre-wrap flex gap-2">
                                        <FileText size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                        <div><strong>Note:</strong> {formatTextWithNumbers(activeCase.note)}</div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 border-b p-3 font-bold text-sm text-gray-600 grid grid-cols-12 gap-4">
                                    <div className="col-span-1 text-center">#</div>
                                    <div className="col-span-4">Action</div>
                                    <div className={`col-span-${isAppMode ? '3' : '5'}`}>Expected Result</div>
                                    {isAppMode ? (
                                        <>
                                            <div className="col-span-2 text-center">iOS</div>
                                            <div className="col-span-2 text-center">Android</div>
                                        </>
                                    ) : (
                                        <div className="col-span-2 text-center">Result</div>
                                    )}
                                </div>
                                <div className="divide-y">
                                    {activeCase.steps.map((step, i) => (
                                        <div key={i} className="p-3 grid grid-cols-12 gap-4 items-start text-sm hover:bg-gray-50">
                                            <div className="col-span-1 text-center text-gray-400 font-bold pt-1">{i + 1}</div>
                                            <div className="col-span-4 whitespace-pre-wrap leading-relaxed">{formatTextWithNumbers(step.step)}</div>
                                            <div className={`col-span-${isAppMode ? '3' : '5'} whitespace-pre-wrap leading-relaxed text-gray-600 border-l pl-4`}>{formatTextWithNumbers(step.expected)}</div>
                                            
                                            {isAppMode ? (
                                                <>
                                                    <div className="col-span-2">
                                                        <StatusDropdown 
                                                            value={iosResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'} 
                                                            onChange={(val) => handleStepUpdate('iOS', step.id, val)}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <StatusDropdown 
                                                            value={aosResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'} 
                                                            onChange={(val) => handleStepUpdate('Android', step.id, val)}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="col-span-2">
                                                    <StatusDropdown 
                                                        value={pcResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'} 
                                                        onChange={(val) => handleStepUpdate('PC', step.id, val)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="h-[400px]">
                                {isAppMode ? (
                                    <div className="grid grid-cols-2 gap-6 h-full">
                                        <BottomResultPane 
                                            platform="iOS" 
                                            data={iosResult} 
                                            initialHistory={iosResult.history || []}
                                            onUpdate={(f, v) => handleResultUpdate('iOS', f, v)} 
                                            onSaveNext={handleNext}
                                        />
                                        <BottomResultPane 
                                            platform="Android" 
                                            data={aosResult} 
                                            initialHistory={aosResult.history || []}
                                            onUpdate={(f, v) => handleResultUpdate('Android', f, v)} 
                                            onSaveNext={handleNext}
                                        />
                                    </div>
                                ) : (
                                    <BottomResultPane 
                                        platform="PC" 
                                        data={pcResult} 
                                        initialHistory={pcResult.history || []}
                                        onUpdate={(f, v) => handleResultUpdate('PC', f, v)} 
                                        onSaveNext={handleNext}
                                    />
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