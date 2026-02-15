import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    PlayCircle, Trash2, ArrowLeft, ChevronUp, ChevronDown, BarChart2,
    AlertOctagon, ChevronLeft, ChevronRight, CheckCircle, Bug, RotateCcw, Loader2, FileText,
    Smartphone, Monitor
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

// Local type extension for UI display
interface TestCaseWithSection extends TestCase {
    sectionTitle?: string;
}

// -------------------------------------------------------------------------
// [Sub Component] 결과 입력 패널 (하나의 플랫폼에 대한 결과 처리 담당)
// -------------------------------------------------------------------------
const TestResultPane = ({
    runId,
    caseId,
    platform, // 'PC' | 'iOS' | 'Android'
    initialResult,
    userId,
    onNext // 'Pass & Next' 클릭 시 부모에게 다음 케이스 이동 요청
}: {
    runId: string,
    caseId: string,
    platform: DevicePlatform,
    initialResult: TestResult | undefined,
    userId: string,
    onNext: () => void
}) => {
    // Local State for Form
    const [status, setStatus] = useState<TestStatus>('UNTESTED');
    const [actual, setActual] = useState('');
    const [comment, setComment] = useState('');
    const [defectLabel, setDefectLabel] = useState('');
    const [defectUrl, setDefectUrl] = useState('');
    const [stepResults, setStepResults] = useState<{ stepId: string, status: TestStatus }[]>([]);
    
    // History
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [currentResultHistory, setCurrentResultHistory] = useState<ExecutionHistoryItem[]>([]);
    
    // UI Loading
    const [isProcessing, setIsProcessing] = useState(false);

    // [Init] 케이스가 변경되거나 초기 데이터가 들어오면 폼 리셋
    useEffect(() => {
        if (initialResult) {
            setStatus(initialResult.status);
            setActual(initialResult.actualResult || '');
            setComment(initialResult.comment || '');
            if (initialResult.issues && initialResult.issues.length > 0) {
                setDefectLabel(initialResult.issues[0].label);
                setDefectUrl(initialResult.issues[0].url);
            } else {
                setDefectLabel('');
                setDefectUrl('');
            }
            setStepResults(initialResult.stepResults || []);
            setCurrentResultHistory(initialResult.history || []);
        } else {
            // 데이터가 없으면 초기화
            setStatus('UNTESTED');
            setActual('');
            setComment('');
            setDefectLabel('');
            setDefectUrl('');
            setStepResults([]);
            setCurrentResultHistory([]);
        }
        setHistoryExpanded(false);
    }, [initialResult, caseId]); // caseId가 바뀌면 무조건 리셋

    // [Logic] 자동 저장
    const autoSave = async (
        targetStatus: TestStatus,
        targetActual: string,
        targetComment: string,
        targetDefectLabel: string,
        targetDefectUrl: string,
        targetStepResults: { stepId: string, status: TestStatus }[]
    ) => {
        const issues: Issue[] = [];
        if (targetDefectLabel && targetDefectUrl) {
            issues.push({ id: Date.now().toString(), label: targetDefectLabel, url: targetDefectUrl });
        }

        const payload: Partial<TestResult> = {
            runId,
            caseId,
            device_platform: platform, // [중요] 플랫폼 구분 저장
            status: targetStatus,
            actualResult: targetActual,
            comment: targetComment,
            testerId: userId,
            stepResults: targetStepResults,
            issues
        };

        await RunService.saveResult(payload);
        
        // 히스토리 최신화 (UX용)
        const freshResults = await RunService.getResults(runId);
        const fresh = freshResults.find(r => r.caseId === caseId && r.device_platform === platform);
        if (fresh) setCurrentResultHistory(fresh.history || []);
    };

    // [Handler] 상태 변경
    const handleStatusChange = (newStatus: TestStatus) => {
        setStatus(newStatus);
        autoSave(newStatus, actual, comment, defectLabel, defectUrl, stepResults);
    };

    // [Handler] 스텝 결과 변경
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

    // [Handler] Pass & Next
    const forcePassAndNext = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const nextStatus = status === 'FAIL' ? 'FAIL' : 'PASS';
            await autoSave(nextStatus, actual, comment, defectLabel, defectUrl, stepResults);
            onNext(); // 부모에게 다음 케이스 이동 요청
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
            testerId: userId || 'unknown',
            timestamp: new Date().toISOString(),
            issues: (defectLabel && defectUrl) ? [{ id: 'temp', label: defectLabel, url: defectUrl }] : [],
            stepResults,
            isCurrent: true
        },
        ...currentResultHistory.map(h => ({ ...h, isCurrent: false }))
    ];

    return (
        <div className="flex flex-col h-full">
            {/* 플랫폼 헤더 */}
            <div className={`font-bold text-sm mb-2 flex items-center gap-2 py-1 px-2 rounded-t-lg border-b-2 
                ${platform === 'iOS' ? 'bg-gray-50 text-gray-800 border-gray-300' : 
                  platform === 'Android' ? 'bg-green-50 text-green-800 border-green-300' : 
                  'bg-blue-50 text-blue-800 border-blue-300'}`}>
                {platform === 'iOS' && <span className="text-lg">🍎</span>}
                {platform === 'Android' && <span className="text-lg">🤖</span>}
                {platform === 'PC' && <span className="text-lg">🖥️</span>}
                {platform === 'PC' ? 'WEB' : platform} Result
            </div>

            <div className={`flex-1 rounded-b-xl p-4 transition-colors shadow-sm border-2 ${getStatusColor(status).replace('text-', 'border-').split(' ')[2]} bg-white overflow-y-auto`}>
                {/* 상단 버튼 그룹 */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><PlayCircle size={18} /> Test Result</h3>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg scale-90 origin-right">
                        {(['PASS', 'FAIL', 'BLOCK', 'NA'] as TestStatus[]).map(s => (
                            <button
                                key={s}
                                onClick={() => handleStatusChange(s)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${status === s ? getStatusColor(s) + ' shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 입력 필드들 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Actual Result</label>
                        <textarea
                            className="w-full border rounded p-2 text-sm h-20 resize-none focus:ring-1 focus:ring-primary focus:border-primary"
                            placeholder="실제 결과 입력..."
                            value={actual}
                            onChange={e => setActual(e.target.value)}
                            onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Comment</label>
                        <input
                            className="w-full border rounded p-2 text-sm h-9 focus:ring-1 focus:ring-primary focus:border-primary"
                            placeholder="비고 사항..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                        />
                    </div>

                    {status === 'FAIL' && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                            <div className="relative flex-1">
                                <Bug size={14} className="absolute left-2 top-2.5 text-red-400" />
                                <input
                                    className="w-full border border-red-200 bg-red-50 rounded pl-7 p-1.5 text-xs h-9 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500"
                                    placeholder="Issue Key"
                                    value={defectLabel}
                                    onChange={e => setDefectLabel(e.target.value)}
                                    onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                                />
                            </div>
                            <input
                                className="flex-[2] border border-red-200 bg-red-50 rounded p-1.5 text-xs h-9 text-red-800 placeholder-red-300 focus:ring-1 focus:ring-red-500"
                                placeholder="Issue URL..."
                                value={defectUrl}
                                onChange={e => setDefectUrl(e.target.value)}
                                onBlur={() => autoSave(status, actual, comment, defectLabel, defectUrl, stepResults)}
                            />
                        </div>
                    )}
                </div>

                {/* Pass & Next 버튼 */}
                <div className="mt-4 flex justify-end">
                     <button
                        onClick={forcePassAndNext}
                        disabled={isProcessing}
                        className={`
                            px-4 py-2 text-xs font-bold rounded shadow flex items-center gap-2 transition-all duration-200
                            ${isProcessing ? 'bg-blue-400 cursor-not-allowed opacity-80' : 'bg-primary hover:bg-blue-700 active:scale-95 cursor-pointer'}
                            text-white
                        `}
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {status === 'FAIL' ? 'Save & Next' : 'Pass & Next'}
                    </button>
                </div>
            </div>

             {/* 실행 이력 (최소화) */}
             <div className="border-t pt-2 mt-2">
                <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="w-full flex justify-between items-center text-gray-400 font-bold hover:text-gray-600 p-1 text-xs"
                >
                    <span className="flex items-center gap-2"><RotateCcw size={14} /> History</span>
                    {historyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {historyExpanded && (
                    <div className="mt-2 space-y-2 pl-2 max-h-32 overflow-y-auto">
                        {fullHistoryTimeline.length === 0 && <div className="text-center text-gray-300 text-xs py-2">No history.</div>}
                        {fullHistoryTimeline.map((h, idx) => (
                            <div key={idx} className="flex gap-2 items-start text-xs text-gray-500">
                                <span className={`px-1.5 rounded font-bold ${h.status === 'PASS' ? 'bg-green-100 text-green-700' : h.status === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{h.status}</span>
                                <span className="truncate">{new Date(h.timestamp).toLocaleDateString()}</span>
                                {h.isCurrent && <span className="text-blue-500 font-bold text-[10px]">(Cur)</span>}
                            </div>
                        ))}
                    </div>
                )}
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

    const { user, users } = useContext(AuthContext);
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
    const [runResults, setRunResults] = useState<TestResult[]>([]);
    const [runCases, setRunCases] = useState<TestCaseWithSection[]>([]);
    const [activeCaseIndex, setActiveCaseIndex] = useState(0);
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [isReportOpen, setReportOpen] = useState(false);
    const [isDashboardOpen, setDashboardOpen] = useState(true);
    const [runStats, setRunStats] = useState<Record<string, TestResult[]>>({});

    const [loading, setLoading] = useState(true);
    
    // 실행 목록 로드
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

            // Handle URL Query Params
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

    // Update URL function
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

    // 상세 진입 시 데이터 로드
    useEffect(() => {
        if (selectedRun && project) {
            Promise.all([
                TestCaseService.getCases(project.id),
                RunService.getResults(selectedRun.id),
                TestCaseService.getSections(project.id)
            ]).then(([allCases, results, sections]) => {
                const sectionMap = new Map(sections.map(s => [s.id, s.title]));
                // 1. 케이스 정렬 (seq_id 기준)
                const sortedAllCases = allCases.sort((a, b) => (a.seq_id || 0) - (b.seq_id || 0));

                // 2. 정렬된 리스트를 기반으로 필터링
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

    const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("이 테스트 실행(Test Run)을 삭제하시겠습니까?\n포함된 모든 결과 데이터가 영구 삭제됩니다.")) {
            await RunService.delete(runId);
            loadRuns();
        }
    };

    const handlePrev = () => {
        if (activeCaseIndex > 0) {
            const idx = activeCaseIndex - 1;
            setActiveCaseIndex(idx);
            if (selectedRun) updateUrl(selectedRun.id, idx);
        }
    };

    const handleNext = () => {
        if (activeCaseIndex < runCases.length - 1) {
            const idx = activeCaseIndex + 1;
            setActiveCaseIndex(idx);
            if (selectedRun) updateUrl(selectedRun.id, idx);
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
                <RunCreationModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} project={project} onSubmit={async (t, ids) => { await RunService.create({ projectId: project.id, title: t, caseIds: ids }); loadRuns(); }} />
            </div>
        );
    }

    if (runCases.length === 0) return <LoadingSpinner />;

    const activeCase = runCases[activeCaseIndex];
    if (!activeCase) return <div>Data Error</div>;

    // [Helper] 현재 케이스에 대한 결과 조회
    const getResultForPlatform = (targetPlatform: DevicePlatform) => {
        return runResults.find(r => r.caseId === activeCase.id && (r.device_platform === targetPlatform || (!r.device_platform && targetPlatform === 'PC')));
    };

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* 헤더 */}
            <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedRun(null); updateUrl(null, 0); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
                        <ArrowLeft size={24} />
                    </button>

                    <div>
                        <h2 className="font-bold text-xl text-gray-900 leading-tight">{selectedRun.title}</h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <button
                                onClick={() => setDashboardOpen(!isDashboardOpen)}
                                className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-sm font-bold text-gray-700 transition"
                            >
                                <span>{activeCaseIndex + 1} / {runCases.length}</span>
                                {isDashboardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setReportOpen(true)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-bold text-gray-700 shadow-sm transition">
                        <BarChart2 size={18} /> 리포트
                    </button>
                </div>
            </div>

            {/* 대시보드 영역 (Detailed) */}
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
                                {Math.round((stats.pass / (stats.total || 1)) * 100) || 0}%
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
                        const pcRes = runResults.find(r => r.caseId === c.id && (!r.device_platform || r.device_platform === 'PC'));
                        const iosRes = runResults.find(r => r.caseId === c.id && r.device_platform === 'iOS');
                        const aosRes = runResults.find(r => r.caseId === c.id && r.device_platform === 'Android');
                        
                        // 대표 상태 계산 (하나라도 Fail이면 Fail, 모두 Pass면 Pass)
                        let status: TestStatus = 'UNTESTED';
                        if (c.platform_type === 'APP') {
                             if (iosRes?.status === 'FAIL' || aosRes?.status === 'FAIL') status = 'FAIL';
                             else if (iosRes?.status === 'PASS' && aosRes?.status === 'PASS') status = 'PASS';
                             else if (iosRes?.status || aosRes?.status) status = iosRes?.status || aosRes?.status || 'UNTESTED';
                        } else {
                             status = pcRes?.status || 'UNTESTED';
                        }

                        return (
                            <div
                                key={c.id}
                                onClick={() => { setActiveCaseIndex(idx); updateUrl(selectedRun.id, idx); }}
                                className={`p-3 border-b cursor-pointer flex items-center gap-2 text-sm hover:bg-gray-50 ${activeCaseIndex === idx ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
                            >
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status === 'PASS' ? 'bg-green-500' : status === 'FAIL' ? 'bg-red-500' : status === 'BLOCK' ? 'bg-gray-800' : 'bg-gray-300'}`} />
                                <div className="flex flex-col flex-1 min-w-0">
                                   <span className="truncate">{c.title}</span>
                                   {c.platform_type === 'APP' && <span className="text-[10px] text-gray-400 flex gap-1"><Smartphone size={10}/> APP</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 오른쪽: 상세 및 실행 (개선된 UI) */}
                <div className="flex-1 flex overflow-hidden relative group bg-gray-100">

                    {/* 플로팅 이동 버튼 */}
                    <button
                        onClick={handlePrev}
                        disabled={activeCaseIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 text-gray-400 flex items-center justify-center hover:text-primary hover:border-primary hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none"
                    >
                        <ChevronLeft size={32} />
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={activeCaseIndex === runCases.length - 1}
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 text-gray-400 flex items-center justify-center hover:text-primary hover:border-primary hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none"
                    >
                        <ChevronRight size={32} />
                    </button>

                    {/* 메인 컨텐츠 영역 */}
                    <div className="flex-1 overflow-y-auto px-12 py-6">
                        <div className="max-w-6xl mx-auto space-y-4">

                            {/* A. 케이스 헤더 정보 */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <div className="flex gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-600 border">{activeCase.sectionTitle || 'General'}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${activeCase.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{activeCase.priority} Priority</span>
                                    {activeCase.platform_type === 'APP' && <span className="px-2 py-0.5 rounded text-xs font-bold border bg-purple-50 text-purple-600 border-purple-100 flex items-center gap-1"><Smartphone size={10}/> Mobile App</span>}
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

                            {/* B. 테스트 스텝 */}
                            <div className="space-y-3">
                                {activeCase.steps.map((step, i) => (
                                    <div key={i} className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">{i + 1}</div>
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
                                    </div>
                                ))}
                            </div>

                            {/* C. 결과 입력 섹션 (분기 처리) */}
                            <div className="mt-6">
                                {activeCase.platform_type === 'APP' ? (
                                    <div className="grid grid-cols-2 gap-6 h-[500px]">
                                        <TestResultPane 
                                            runId={selectedRun.id}
                                            caseId={activeCase.id}
                                            platform="iOS"
                                            initialResult={getResultForPlatform('iOS')}
                                            userId={user?.id || ''}
                                            onNext={handleNext}
                                        />
                                        <TestResultPane 
                                            runId={selectedRun.id}
                                            caseId={activeCase.id}
                                            platform="Android"
                                            initialResult={getResultForPlatform('Android')}
                                            userId={user?.id || ''}
                                            onNext={handleNext}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-[500px]">
                                        <TestResultPane 
                                            runId={selectedRun.id}
                                            caseId={activeCase.id}
                                            platform="PC"
                                            initialResult={getResultForPlatform('PC')}
                                            userId={user?.id || ''}
                                            onNext={handleNext}
                                        />
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