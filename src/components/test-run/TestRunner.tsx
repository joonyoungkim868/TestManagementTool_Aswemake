
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
    PlayCircle, Trash2, ArrowLeft, ChevronUp, ChevronDown, BarChart2,
    AlertOctagon, ChevronLeft, ChevronRight, CheckCircle, Bug, RotateCcw, Loader2, FileText,
    Smartphone, FolderOpen, Save
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TestRun, TestResult, TestCase, TestStatus, Issue, ExecutionHistoryItem, DevicePlatform, Section, Document } from '../../types';
import { RunService, TestCaseService, DriveService } from '../../storage';
import { AuthContext } from '../../context/AuthContext';
import { formatTextWithNumbers } from '../../utils/formatters';
import { LoadingSpinner } from '../common/Loading';
import { ReportModal } from './ReportModal';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StepRenderer } from '../common/StepRenderer';

interface TestCaseWithContext extends TestCase {
    sectionTitle?: string;
    documentTitle?: string;
    documentId: string;
}

// -------------------------------------------------------------------------
// [Reusable] Dashboard Stats
// -------------------------------------------------------------------------
const DashboardStats = React.memo(({ stats, isDashboardOpen }: { stats: any, isDashboardOpen: boolean }) => {
    if (!isDashboardOpen) return null;
    return (
        <div className="bg-white border-b p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="max-w-6xl mx-auto flex gap-8 items-center justify-center">
                <div className="h-32 w-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={[
                                { name: 'Pass', value: stats.pass, fill: '#22c55e' },
                                { name: 'Fail', value: stats.fail, fill: '#ef4444' },
                                { name: 'Block', value: stats.block, fill: '#1f2937' },
                                { name: 'NA', value: stats.na, fill: '#fb923c' },
                                { name: 'Untested', value: stats.untested, fill: '#e5e7eb' }
                            ]}
                                innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value"
                            >
                                <Cell fill="#22c55e" /><Cell fill="#ef4444" /><Cell fill="#1f2937" /><Cell fill="#fb923c" /><Cell fill="#e5e7eb" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-gray-600 text-xs">
                        <span>{Math.round(((stats.total - stats.untested) / (stats.total || 1)) * 100) || 0}%</span>
                        <span className="text-gray-400 font-normal">Done</span>
                    </div>
                </div>
                <div className="grid grid-cols-5 gap-4">
                    <div className="p-3 bg-green-50 rounded border border-green-100 w-24 text-center"><div className="text-xs font-bold text-green-700">Pass</div><div className="text-xl font-bold text-green-800">{stats.pass}</div></div>
                    <div className="p-3 bg-red-50 rounded border border-red-100 w-24 text-center"><div className="text-xs font-bold text-red-700">Fail</div><div className="text-xl font-bold text-red-800">{stats.fail}</div></div>
                    <div className="p-3 bg-gray-100 rounded border border-gray-200 w-24 text-center"><div className="text-xs font-bold text-gray-700">Block</div><div className="text-xl font-bold text-gray-800">{stats.block}</div></div>
                    <div className="p-3 bg-orange-50 rounded border border-orange-100 w-24 text-center"><div className="text-xs font-bold text-orange-600">N/A</div><div className="text-xl font-bold text-orange-700">{stats.na}</div></div>
                    <div className="p-3 bg-white rounded border border-gray-200 w-24 text-center"><div className="text-xs font-bold text-gray-400">Untested</div><div className="text-xl font-bold text-gray-500">{stats.untested}</div></div>
                </div>
            </div>
        </div>
    );
});

// -------------------------------------------------------------------------
// [Reusable] Sidebar
// -------------------------------------------------------------------------
const CaseSidebar = React.memo(({ runCases, runResults, activeCaseIndex, onSelect }: any) => {
    // Group By Document
    const grouped = useMemo(() => {
        const groups: Record<string, typeof runCases> = {};
        runCases.forEach((c: any) => {
            const key = c.documentTitle || 'Unknown Document';
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });
        return groups;
    }, [runCases]);

    return (
        <div className="w-72 bg-white border-r overflow-y-auto hidden md:block">
            {Object.entries(grouped).map(([docTitle, cases]: [string, any[]]) => (
                <div key={docTitle}>
                    <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 uppercase flex items-center gap-2 sticky top-0 z-10 border-y">
                        <FolderOpen size={12} /> {docTitle}
                    </div>
                    {cases.map((c: any) => {
                        // Find global index
                        const globalIndex = runCases.findIndex((rc: any) => rc.id === c.id);
                        const cPcRes = runResults.find((r: any) => r.caseId === c.id && (!r.device_platform || r.device_platform === 'PC'));
                        const cIosRes = runResults.find((r: any) => r.caseId === c.id && r.device_platform === 'iOS');
                        const cAosRes = runResults.find((r: any) => r.caseId === c.id && r.device_platform === 'Android');

                        let status: TestStatus = 'UNTESTED';
                        if (c.platform_type === 'APP') {
                            if (cIosRes?.status === 'FAIL' || cAosRes?.status === 'FAIL') status = 'FAIL';
                            else if (cIosRes?.status === 'BLOCK' || cAosRes?.status === 'BLOCK') status = 'BLOCK';
                            else if (cIosRes?.status === 'NA' || cAosRes?.status === 'NA') status = 'NA';
                            else if (cIosRes?.status === 'PASS' && cAosRes?.status === 'PASS') status = 'PASS';
                            else status = 'UNTESTED';
                        } else {
                            status = cPcRes?.status || 'UNTESTED';
                        }

                        let statusColor = 'bg-gray-300';
                        if (status === 'PASS') statusColor = 'bg-green-500';
                        else if (status === 'FAIL') statusColor = 'bg-red-500';
                        else if (status === 'BLOCK') statusColor = 'bg-gray-800';
                        else if (status === 'NA') statusColor = 'bg-orange-400';

                        return (
                            <div key={c.id} onClick={() => onSelect(globalIndex)} className={`p-3 border-b cursor-pointer flex items-center gap-2 text-sm hover:bg-gray-50 ${activeCaseIndex === globalIndex ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}>
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColor}`} />
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate">{c.title}</span>
                                    {c.sectionTitle && <span className="text-[10px] text-gray-400 truncate">{c.sectionTitle}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});

const StatusDropdown = ({ value, onChange, disabled }: { value: TestStatus, onChange: (s: TestStatus) => void, disabled?: boolean }) => {
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
            disabled={disabled}
            className={`h-8 text-xs font-bold rounded border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 cursor-pointer px-2 w-full transition-colors ${getBgColor(value)} disabled:opacity-50 disabled:cursor-not-allowed`}
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
// [Sub Component] Bottom Pane
// -------------------------------------------------------------------------
const BottomResultPane = ({
    platform,
    data,
    initialHistory,
    onUpdate,
    onSave,
    onStatusUpdate,
    onSaveNext,
    disabled
}: any) => {
    const status = data.status || 'UNTESTED';
    const actual = data.actualResult || '';
    const comment = data.comment || '';
    const defectLabel = data.issues?.[0]?.label || '';
    const defectUrl = data.issues?.[0]?.url || '';

    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePassAndNext = () => {
        if (isProcessing || disabled) return;
        setIsProcessing(true);
        const nextStatus = status === 'FAIL' ? 'FAIL' : 'PASS';
        onStatusUpdate(nextStatus);
        onSaveNext();
        setTimeout(() => setIsProcessing(false), 300);
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

    return (
        <div className={`flex flex-col h-full rounded-xl shadow-sm border-2 bg-white overflow-hidden ${getStatusColor(status).replace('text-', 'border-').split(' ')[2]}`}>
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                <div className="font-bold text-sm flex items-center gap-2">
                    {platform === 'iOS' && 'iOS'}
                    {platform === 'Android' && 'Android'}
                    {platform === 'PC' && 'WEB'}
                </div>
                <div className="flex gap-1 scale-90 origin-right">
                    {!disabled && (['PASS', 'FAIL', 'BLOCK', 'NA'] as TestStatus[]).map(s => (
                        <button
                            key={s}
                            onClick={() => onStatusUpdate(s)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${status === s ? getStatusColor(s) + ' shadow-sm' : 'text-gray-400 hover:bg-gray-200 bg-white border'}`}
                        >
                            {s}
                        </button>
                    ))}
                    {disabled && <span className="text-xs font-bold text-gray-500 px-2">{status}</span>}
                </div>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Actual Result</label>
                    <textarea
                        disabled={disabled}
                        className="w-full border rounded p-2 text-sm h-20 resize-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                        placeholder="Actual Result..."
                        value={actual}
                        onChange={e => onUpdate('actualResult', e.target.value)}
                        onBlur={onSave}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Comment</label>
                    <input
                        disabled={disabled}
                        className="w-full border rounded p-2 text-sm h-9 focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                        placeholder="Comment..."
                        value={comment}
                        onChange={e => onUpdate('comment', e.target.value)}
                        onBlur={onSave}
                    />
                </div>
                {status === 'FAIL' && (
                    <div className="mt-4 pt-4 border-t border-red-100">
                        <label className="text-sm font-semibold text-red-600 flex items-center gap-1 mb-2">
                            <Bug size={14} /> 결함 (Defects)
                        </label>
                        <div className="flex gap-2 items-center bg-red-50 p-2 rounded border border-red-100">
                            <input
                                disabled={disabled}
                                className="border rounded px-2 py-1.5 flex-1 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none disabled:bg-gray-100"
                                placeholder="이슈 제목 (예: QA-123 로그인 버튼 겹침)"
                                value={defectLabel}
                                onChange={e => onUpdate('issues', [{
                                    id: data.issues?.[0]?.id || Date.now().toString(),
                                    label: e.target.value,
                                    url: defectUrl
                                }])}
                                onBlur={onSave}
                            />
                            <input
                                disabled={disabled}
                                className="border rounded px-2 py-1.5 flex-1 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none disabled:bg-gray-100"
                                placeholder="이슈 URL (옵션)"
                                value={defectUrl}
                                onChange={e => onUpdate('issues', [{
                                    id: data.issues?.[0]?.id || Date.now().toString(),
                                    label: defectLabel,
                                    url: e.target.value
                                }])}
                                onBlur={onSave}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t bg-gray-50">
                <div className="p-3 flex justify-end">
                    {!disabled && (
                        <button
                            onClick={handlePassAndNext}
                            disabled={isProcessing}
                            className={`px-4 py-1.5 text-xs font-bold rounded shadow flex items-center gap-1 transition-all duration-200 text-white ${isProcessing ? 'bg-blue-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-700'}`}
                        >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            {status === 'FAIL' ? 'Save & Next' : 'Pass & Next'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// -------------------------------------------------------------------------
// [Main Component] Test Runner
// -------------------------------------------------------------------------
export const TestRunner = () => {
    const { runId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [run, setRun] = useState<TestRun | null>(null);
    const [runCases, setRunCases] = useState<TestCaseWithContext[]>([]);
    const [runResults, setRunResults] = useState<TestResult[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeCaseIndex, setActiveCaseIndex] = useState(0);
    const [isDashboardOpen, setDashboardOpen] = useState(true);
    const [isReportOpen, setReportOpen] = useState(false);

    // Local State for Active Case
    const [pcResult, setPcResult] = useState<Partial<TestResult>>({});
    const [iosResult, setIosResult] = useState<Partial<TestResult>>({});
    const [aosResult, setAosResult] = useState<Partial<TestResult>>({});

    // Refs for latest state access
    const pcRef = useRef(pcResult);
    const iosRef = useRef(iosResult);
    const aosRef = useRef(aosResult);

    useEffect(() => { pcRef.current = pcResult; }, [pcResult]);
    useEffect(() => { iosRef.current = iosResult; }, [iosResult]);
    useEffect(() => { aosRef.current = aosResult; }, [aosResult]);

    // Initialize Data
    useEffect(() => {
        loadData();
    }, [runId]);

    const loadData = async () => {
        if (!runId) return;
        setLoading(true);
        try {
            const r = await RunService.getById(runId);
            if (!r) throw new Error("Run not found");
            setRun(r);

            if (r.status === 'COMPLETED' && r.snapshot_data) {
                // Load from Snapshot
                setRunCases(r.snapshot_data.cases || []);
                setRunResults(r.snapshot_data.results || []);
            } else {
                // Fetch Live Data
                const docIds = r.target_document_ids || [];
                if (docIds.length > 0) {
                    const [cases, sections, results, docs] = await Promise.all([
                        TestCaseService.getCasesByDocumentIds(docIds),
                        TestCaseService.getSectionsByDocumentIds(docIds),
                        RunService.getResults(runId),
                        DriveService.getAllDocuments() // To map doc titles
                    ]);

                    const docMap = new Map(docs.map(d => [d.id, d.title]));
                    const secMap = new Map(sections.map(s => [s.id, s.title]));

                    // Enrich Cases
                    const enrichedCases = cases.map(c => ({
                        ...c,
                        documentTitle: docMap.get(c.documentId) || 'Unknown Doc',
                        sectionTitle: secMap.get(c.sectionId)
                    }));

                    // Sort: Doc Title -> Section Title -> Priority -> SeqID
                    enrichedCases.sort((a, b) => {
                        if (a.documentTitle !== b.documentTitle) return (a.documentTitle || '').localeCompare(b.documentTitle || '');
                        if (a.sectionTitle !== b.sectionTitle) return (a.sectionTitle || '').localeCompare(b.sectionTitle || '');
                        return (a.seq_id || 0) - (b.seq_id || 0);
                    });

                    setRunCases(enrichedCases);
                    setRunResults(results);
                }
            }

            // Set Initial Index from URL
            const caseParam = searchParams.get('case');
            if (caseParam) setActiveCaseIndex(parseInt(caseParam));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Update URL when index changes
    const handleCaseSelect = (index: number) => {
        setActiveCaseIndex(index);
        setSearchParams({ case: index.toString() });
    };

    // Initialize Local State when Active Case Changes
    useEffect(() => {
        const activeCase = runCases[activeCaseIndex];
        if (!activeCase) return;

        const caseResults = runResults.filter(r => r.caseId === activeCase.id);
        const init = (platform: DevicePlatform) => {
            const found = caseResults.find(r => r.device_platform === platform) || caseResults.find(r => !r.device_platform && platform === 'PC');
            return found || { status: 'UNTESTED', stepResults: [], device_platform: platform };
        };

        setPcResult(init('PC'));
        setIosResult(init('iOS'));
        setAosResult(init('Android'));
    }, [activeCaseIndex, runResults]); // runCases stable typically

    // Actions
    const updateLocalState = (platform: DevicePlatform, field: keyof TestResult, value: any) => {
        const setter = platform === 'PC' ? setPcResult : platform === 'iOS' ? setIosResult : setAosResult;
        setter(prev => ({ ...prev, [field]: value }));
    };

    const saveToBackend = async (platform: DevicePlatform, data = null) => {
        if (!run || run.status === 'COMPLETED') return;
        const currentCase = runCases[activeCaseIndex];
        const targetState = data || (platform === 'iOS' ? iosRef.current : platform === 'Android' ? aosRef.current : pcRef.current);

        const payload: Partial<TestResult> = {
            runId: run.id,
            caseId: currentCase.id,
            device_platform: platform,
            testerId: user?.id,
            ...targetState
        };
        await RunService.saveResult(payload);
        const newResults = await RunService.getResults(run.id);
        setRunResults(newResults);
    };

    const handleStatusUpdate = (platform: DevicePlatform, newStatus: TestStatus) => {
        updateLocalState(platform, 'status', newStatus);
        const ref = platform === 'iOS' ? iosRef : platform === 'Android' ? aosRef : pcRef;
        const newState = { ...ref.current, status: newStatus };
        saveToBackend(platform, newState);
    };

    const handleStepUpdate = (platform: DevicePlatform, stepId: string, newStatus: TestStatus) => {
        const ref = platform === 'iOS' ? iosRef : platform === 'Android' ? aosRef : pcRef;
        const currentSteps = ref.current.stepResults || [];
        const updatedSteps = currentSteps.filter(s => s.stepId !== stepId);
        updatedSteps.push({ stepId, status: newStatus });

        // Autocalc Status logic (same as before)
        const totalSteps = runCases[activeCaseIndex].steps.length;
        const validResults = updatedSteps.filter(s => s.status !== 'UNTESTED');
        let calculatedStatus: TestStatus = 'UNTESTED';
        const hasFail = validResults.some(s => s.status === 'FAIL');
        const hasBlock = validResults.some(s => s.status === 'BLOCK');
        const hasNA = validResults.some(s => s.status === 'NA');

        if (hasFail) calculatedStatus = 'FAIL';
        else if (hasBlock) calculatedStatus = 'BLOCK';
        else if (hasNA) calculatedStatus = 'NA';
        else if (validResults.length >= totalSteps) calculatedStatus = 'PASS';

        updateLocalState(platform, 'stepResults', updatedSteps);
        updateLocalState(platform, 'status', calculatedStatus);

        saveToBackend(platform, { ...ref.current, stepResults: updatedSteps, status: calculatedStatus });
    };

    const handleFinishRun = async () => {
        if (!run) return;
        if (!window.confirm("Complete this run? \nThis will create a permanent snapshot of all cases and results.")) return;

        const snapshot = {
            meta: run,
            cases: runCases,
            results: runResults,
            completedAt: new Date().toISOString()
        };

        await RunService.finishRun(run.id, snapshot);
        loadData(); // Reload to show read-only view
    };

    // Stats
    const stats = useMemo(() => {
        const total = runCases.length;
        let pass = 0, fail = 0, block = 0, na = 0;

        runCases.forEach(c => {
            const caseResults = runResults.filter(r => r.caseId === c.id);
            let finalStatus: TestStatus = 'UNTESTED';

            if (c.platform_type === 'APP') {
                const iosRes = caseResults.find(r => r.device_platform === 'iOS');
                const aosRes = caseResults.find(r => r.device_platform === 'Android');

                if (iosRes?.status === 'FAIL' || aosRes?.status === 'FAIL') finalStatus = 'FAIL';
                else if (iosRes?.status === 'BLOCK' || aosRes?.status === 'BLOCK') finalStatus = 'BLOCK';
                else if (iosRes?.status === 'NA' || aosRes?.status === 'NA') finalStatus = 'NA';
                else if (iosRes?.status === 'PASS' && aosRes?.status === 'PASS') finalStatus = 'PASS';
                else finalStatus = 'UNTESTED';
            } else {
                const pcRes = caseResults.find(r => !r.device_platform || r.device_platform === 'PC');
                finalStatus = pcRes?.status || 'UNTESTED';
            }

            if (finalStatus === 'PASS') pass++;
            else if (finalStatus === 'FAIL') fail++;
            else if (finalStatus === 'BLOCK') block++;
            else if (finalStatus === 'NA') na++;
        });

        const untested = total - (pass + fail + block + na);
        return { total, pass, fail, block, na, untested };
    }, [runCases, runResults]);

    if (loading) return <LoadingSpinner />;
    if (!run) return <div>Run not found</div>;

    const activeCase = runCases[activeCaseIndex];
    const isAppMode = activeCase?.platform_type === 'APP';
    const isReadOnly = run.status === 'COMPLETED';

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/runs')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-xl text-gray-900 leading-tight">{run.title}</h2>
                            {isReadOnly && <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded font-bold">COMPLETED</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            <button onClick={() => setDashboardOpen(!isDashboardOpen)} className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-sm font-bold text-gray-700">
                                <span>{activeCaseIndex + 1} / {runCases.length}</span>
                                {isDashboardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {/* Mini Progress Bar */}
                            <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                                <div className="h-full bg-green-500" style={{ width: `${(stats.pass / (stats.total || 1)) * 100}%` }} />
                                <div className="h-full bg-red-500" style={{ width: `${(stats.fail / (stats.total || 1)) * 100}%` }} />
                                <div className="h-full bg-gray-800" style={{ width: `${(stats.block / (stats.total || 1)) * 100}%` }} />
                                <div className="h-full bg-orange-400" style={{ width: `${(stats.na / (stats.total || 1)) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setReportOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 flex items-center gap-2">
                        <BarChart2 size={18} /> 리포트 보기
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleFinishRun} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 flex items-center gap-2">
                            <Save size={18} /> Finish Run
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard */}
            <DashboardStats stats={stats} isDashboardOpen={isDashboardOpen} />

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                <CaseSidebar
                    runCases={runCases}
                    runResults={runResults}
                    activeCaseIndex={activeCaseIndex}
                    onSelect={handleCaseSelect}
                />

                <div className="flex-1 flex flex-col relative bg-gray-100 overflow-hidden">
                    {/* Nav Buttons */}
                    <button onClick={() => handleCaseSelect(Math.max(0, activeCaseIndex - 1))} disabled={activeCaseIndex === 0} className="absolute left-4 top-1/2 z-20 p-2 bg-white rounded-full shadow hover:text-primary disabled:opacity-0"><ChevronLeft size={24} /></button>
                    <button onClick={() => handleCaseSelect(Math.min(runCases.length - 1, activeCaseIndex + 1))} disabled={activeCaseIndex === runCases.length - 1} className="absolute right-4 top-1/2 z-20 p-2 bg-white rounded-full shadow hover:text-primary disabled:opacity-0"><ChevronRight size={24} /></button>

                    <div className="flex-1 overflow-y-auto px-12 py-6">
                        <div className="max-w-6xl mx-auto space-y-6">
                            {activeCase ? (
                                <>
                                    {/* Case Detail Card */}
                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                        <div className="flex gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-600 border">{activeCase.documentTitle} / {activeCase.sectionTitle}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${activeCase.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{activeCase.priority}</span>
                                        </div>
                                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{activeCase.title}</h1>
                                        {activeCase.precondition && (
                                            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200 whitespace-pre-wrap flex gap-2">
                                                <AlertOctagon size={16} className="mt-0.5 flex-shrink-0" />
                                                <div><strong>Precondition:</strong> {formatTextWithNumbers(activeCase.precondition)}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Steps Table */}
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
                                                    <div className="col-span-4"><StepRenderer text={step.step} /></div>
                                                    <div className={`col-span-${isAppMode ? '3' : '5'} whitespace-pre-wrap leading-relaxed text-gray-600 border-l pl-4`}>{formatTextWithNumbers(step.expected)}</div>

                                                    {isAppMode ? (
                                                        <>
                                                            <div className="col-span-2">
                                                                <StatusDropdown
                                                                    value={iosResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'}
                                                                    onChange={(val) => handleStepUpdate('iOS', step.id, val)}
                                                                    disabled={isReadOnly}
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <StatusDropdown
                                                                    value={aosResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'}
                                                                    onChange={(val) => handleStepUpdate('Android', step.id, val)}
                                                                    disabled={isReadOnly}
                                                                />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="col-span-2">
                                                            <StatusDropdown
                                                                value={pcResult.stepResults?.find(s => s.stepId === step.id)?.status || 'UNTESTED'}
                                                                onChange={(val) => handleStepUpdate('PC', step.id, val)}
                                                                disabled={isReadOnly}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bottom Input Area */}
                                    <div className="h-[400px]">
                                        {isAppMode ? (
                                            <div className="grid grid-cols-2 gap-6 h-full">
                                                <BottomResultPane
                                                    platform="iOS"
                                                    data={iosResult}
                                                    onUpdate={(f: any, v: any) => updateLocalState('iOS', f, v)}
                                                    onSave={() => saveToBackend('iOS')}
                                                    onStatusUpdate={(s: any) => handleStatusUpdate('iOS', s)}
                                                    onSaveNext={() => handleCaseSelect(Math.min(runCases.length - 1, activeCaseIndex + 1))}
                                                    disabled={isReadOnly}
                                                />
                                                <BottomResultPane
                                                    platform="Android"
                                                    data={aosResult}
                                                    onUpdate={(f: any, v: any) => updateLocalState('Android', f, v)}
                                                    onSave={() => saveToBackend('Android')}
                                                    onStatusUpdate={(s: any) => handleStatusUpdate('Android', s)}
                                                    onSaveNext={() => handleCaseSelect(Math.min(runCases.length - 1, activeCaseIndex + 1))}
                                                    disabled={isReadOnly}
                                                />
                                            </div>
                                        ) : (
                                            <BottomResultPane
                                                platform="PC"
                                                data={pcResult}
                                                onUpdate={(f: any, v: any) => updateLocalState('PC', f, v)}
                                                onSave={() => saveToBackend('PC')}
                                                onStatusUpdate={(s: any) => handleStatusUpdate('PC', s)}
                                                onSaveNext={() => handleCaseSelect(Math.min(runCases.length - 1, activeCaseIndex + 1))}
                                                disabled={isReadOnly}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-gray-400">
                                    <FolderOpen size={48} className="mx-auto mb-4" />
                                    <p>Select a case from the sidebar</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal Integration */}
            <ReportModal isOpen={isReportOpen} onClose={() => setReportOpen(false)} runId={run.id} />
        </div>
    );
};