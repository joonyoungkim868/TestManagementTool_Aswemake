import React, { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { DashboardService } from '../../storage';
import { DashboardSkeleton, LoadingSpinner } from '../common/Loading';
import { ReportModal } from '../test-run/ReportModal';
import { useLayout } from '../layout/MainLayout';

export const Dashboard = () => {
    const { activeProject, isLoading } = useLayout();
    const project = activeProject;

    const [stats, setStats] = useState({ total: 0, activeRuns: 0, passRate: 0, defects: 0 });
    const [chartData, setChartData] = useState<any[]>([]);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!project) return;
        setLoading(true);
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
            setLoading(false);
        });
    }, [project]);

    if (isLoading) return <LoadingSpinner />;
    if (!project) return <div className="p-8 text-center text-gray-500">프로젝트를 찾을 수 없습니다.</div>;
    if (loading) return <DashboardSkeleton />;

    return (
        <div className="p-6 space-y-6 md:h-full overflow-y-auto">
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
                    <BarChart2 size={20} className="text-gray-400" /> 최근 7일간 활동 추이
                </h3>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ dy: 10 }}
                            />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: '#f3f4f6' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                wrapperStyle={{ paddingTop: '20px' }}
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
