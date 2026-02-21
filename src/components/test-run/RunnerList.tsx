import React, { useState, useEffect, useContext } from 'react';
import { Search, Loader2, PlayCircle, FolderOpen, CheckCircle, BarChart2, Plus, Users, Calendar, Filter, Archive, Trash2 } from 'lucide-react';
import { TestRun, User } from '@/src/types';
import { RunService, AuthService } from '@/src/storage';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/Loading';
import { RunCreationDrawer } from './RunCreationDrawer';
import { AuthContext } from '../../context/AuthContext';

export const RunnerList = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [runStats, setRunStats] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [isCreationOpen, setCreationOpen] = useState(false);
    

    // Filters
    const [searchTitle, setSearchTitle] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('OPEN'); 
    const [filterAssignee, setFilterAssignee] = useState<string>(user?.id || 'ALL');
    const [filterPhase, setFilterPhase] = useState<string>('ALL');


    const loadData = async () => {
        setLoading(true);
        try {
            const [r, u] = await Promise.all([
                RunService.getAll(),
                AuthService.getAllUsers()
            ]);

            const openRuns = r.filter(run => run.status === 'OPEN');
            const stats = await RunService.getRunStats(openRuns);

            setRuns(r);
            setUsers(u);
            setRunStats(stats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // [신규 추가] 테스트 실행 삭제 핸들러
    const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 카드 클릭 시 상세 페이지로 이동하는 이벤트 방지
        if (window.confirm("이 테스트 실행(Test Run)을 삭제하시겠습니까?\n관련된 테스트 결과가 모두 영구 삭제됩니다.")) {
            await RunService.delete(runId);
            loadData(); // 삭제 후 리스트 새로고침
        }
    };

    // Derived Filters
    const uniquePhases = Array.from(new Set(runs.map(r => r.phase).filter(Boolean)));

    const filteredRuns = runs.filter(run => {
        // 1. Search
        if (searchTitle && !run.title.toLowerCase().includes(searchTitle.toLowerCase())) return false;

        // 2. Status
        if (filterStatus !== 'ALL' && run.status !== filterStatus) return false;

        // 3. Phase
        if (filterPhase !== 'ALL' && run.phase !== filterPhase) return false;

        // 4. Assignee
        if (filterAssignee !== 'ALL' && !run.assignees?.includes(filterAssignee)) return false;

        return true;
    });

    const getProgress = (run: TestRun) => {
        if (run.status === 'COMPLETED' && run.snapshot_data) {
            const results = run.snapshot_data.results || [];
            const total = run.snapshot_data.cases ? run.snapshot_data.cases.length : results.length;
            const pass = results.filter((r: any) => r.status === 'PASS').length;
            const fail = results.filter((r: any) => r.status === 'FAIL').length;
            const block = results.filter((r: any) => r.status === 'BLOCK').length;
            const na = results.filter((r: any) => r.status === 'NA').length;
            const executed = pass + fail + block + na;
            const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
            return { percent, label: `${percent}% (${executed}/${total})` };
        } else if (runStats[run.id]) {
            const { total, pass, fail, block, na } = runStats[run.id];
            const executed = pass + fail + block + na;
            const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
            return { percent, label: `${percent}% (${executed}/${total})` };
        }
        return { percent: 0, label: 'Calculating...' };
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <PlayCircle className="text-blue-600" /> Test Runners
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and execute test cycles across multiple documents.</p>
                </div>
                <button
                    onClick={() => setCreationOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-700 flex items-center gap-2 transition"
                >
                    <Plus size={18} /> New Test Run
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-b px-6 py-3 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg flex-1 min-w-[200px]">
                    <Search size={18} className="text-gray-400" />
                    <input
                        className="bg-transparent outline-none flex-1 text-sm"
                        placeholder="Search by title..."
                        value={searchTitle}
                        onChange={e => setSearchTitle(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select
                        className="bg-gray-50 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="OPEN">Open</option>
                        <option value="COMPLETED">Completed</option>
                    </select>

                    <select
                        className="bg-gray-50 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={filterPhase}
                        onChange={e => setFilterPhase(e.target.value)}
                    >
                        <option value="ALL">All Phases</option>
                        {uniquePhases.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select
                        className="bg-gray-50 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={filterAssignee}
                        onChange={e => setFilterAssignee(e.target.value)}
                    >
                        <option value="ALL">All Assignees</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Run List */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRuns.map(run => (
                        <div
                            key={run.id}
                            onClick={() => navigate(`/runs/${run.id}`)}
                            className="bg-white rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col overflow-hidden"
                        >
                            <div className="p-5 flex-1">
                                {/* [신규 추가] 상태 영역 + 삭제 버튼 배치 */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${run.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {run.status}
                                        </span>
                                        {run.phase && (
                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-bold">
                                                {run.phase}
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteRun(run.id, e)} 
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition opacity-0 group-hover:opacity-100"
                                        title="Delete Test Run"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {run.title}
                                </h3>
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                                    {run.description || 'No description provided.'}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        {new Date(run.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Users size={14} />
                                        {run.assignees?.length || 0} Assignees
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <FolderOpen size={14} />
                                        {(run.target_document_ids || []).length} Docs
                                    </div>
                                </div>
                            </div>

                            {/* Progress Footer */}
                            <div className="bg-gray-50 px-5 py-3 border-t">
                                <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1">
                                    <span>Progress</span>
                                    <span>{getProgress(run).label}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${run.status === 'COMPLETED' ? 'bg-gray-500' : 'bg-blue-500'}`}
                                        style={{ width: `${getProgress(run).percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredRuns.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center">
                            <Archive size={48} className="mb-4 opacity-20" />
                            <p className="text-lg">No test runs found matching your filters.</p>
                            <button onClick={() => {
                                setSearchTitle('');
                                setFilterStatus('ALL');
                                setFilterPhase('ALL');
                                setFilterAssignee('ALL');
                            }} className="mt-4 text-blue-600 hover:underline font-bold text-sm">Clear Filters</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Creation Drawer */}
            <RunCreationDrawer
                isOpen={isCreationOpen}
                onClose={() => setCreationOpen(false)}
                onCreated={loadData}
            />
        </div>
    );
};

export default RunnerList;