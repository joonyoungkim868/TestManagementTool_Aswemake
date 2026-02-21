
import React, { useEffect, useState } from 'react';
import { X, BarChart2, PieChart as PieIcon, Activity, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { DashboardService } from '../../storage';
import { LoadingSpinner } from '../common/Loading';

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    contextType: 'FOLDER' | 'DOCUMENT' | 'ALL';
    contextId: string | null; // null for ALL
    title?: string;
}

export const DashboardModal = ({ isOpen, onClose, contextType, contextId, title }: DashboardModalProps) => {
    const [stats, setStats] = useState({ totalCases: 0, activeRuns: 0, passRate: 0, defectCount: 0 });
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadStats();
        }
    }, [isOpen, contextId]);

    const loadStats = async () => {
        setLoading(true);
        try {
            // TODO: DashboardService needs to support context-based fetching
            // For now, we might need to update Storage.ts to accept folderId/docId
            const data = await DashboardService.getStats(contextId, contextType);
            setStats({
                totalCases: data.totalCases,
                activeRuns: data.activeRuns,
                passRate: data.passRate,
                defectCount: data.defectCount
            });
            setChartData(data.chartData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <BarChart2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
                            <p className="text-xs text-gray-500 font-medium">Context: {title || 'Global'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center"><LoadingSpinner /></div>
                    ) : (
                        <div className="space-y-6">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-500 font-bold text-xs uppercase">Total Cases</span>
                                        <PieIcon size={16} className="text-blue-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-800 mt-2">{stats.totalCases}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-500 font-bold text-xs uppercase">Active Runs</span>
                                        <Activity size={16} className="text-indigo-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-800 mt-2">{stats.activeRuns}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-500 font-bold text-xs uppercase">Pass Rate</span>
                                        <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Automated</div>
                                    </div>
                                    <div className="text-3xl font-bold text-green-600 mt-2">{stats.passRate}%</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-500 font-bold text-xs uppercase">Defects</span>
                                        <AlertCircle size={16} className="text-red-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-red-500 mt-2">{stats.defectCount}</div>
                                </div>
                            </div>

                            {/* Main Chart */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                                    <Activity size={18} /> Recent Activity Trend
                                </h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af', dy: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                            <Tooltip
                                                cursor={{ fill: '#f9fafb' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                                            <Bar dataKey="passed" name="Success" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={20} stackId="a" />
                                            <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} stackId="a" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
