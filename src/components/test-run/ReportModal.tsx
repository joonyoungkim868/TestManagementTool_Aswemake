import React, { useState, useEffect } from 'react';
import { BarChart2, XCircle, FileText, Bug, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { TestRun, TestResult, Issue, TestCase, TestStatus } from '../../types';
import { RunService, TestCaseService } from '../../storage';

export const ReportModal = ({
    isOpen, onClose, runId
}: {
    isOpen: boolean, onClose: () => void, runId?: string
}) => {
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string>('');
    const [reportData, setReportData] = useState<{
        run: TestRun,
        results: TestResult[],
        pass: number,
        fail: number,
        untested: number,
        block: number,
        na: number,
        allDefects: { issue: Issue, caseTitle: string }[]
    } | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (runId) {
                setSelectedRunId(runId);
            } else {
                RunService.getAll().then(setRuns);
                setSelectedRunId('');
            }
            setReportData(null);
        }
    }, [isOpen, runId]);

    useEffect(() => {
        if (!selectedRunId) return;

        RunService.getById(selectedRunId).then(async (run) => {
            if (!run) return;

            let results: TestResult[] = [];
            let cases: TestCase[] = [];

            if (run.status === 'COMPLETED' && run.snapshot_data) {
                results = run.snapshot_data.results || [];
                cases = run.snapshot_data.cases || [];
            } else {
                const targetDocIds = run.target_document_ids || [];
                [results, cases] = await Promise.all([
                    RunService.getResults(run.id),
                    targetDocIds.length > 0 ? TestCaseService.getCasesByDocumentIds(targetDocIds) : Promise.resolve([])
                ]);
            }

            let pass = 0, fail = 0, block = 0, na = 0;
            cases.forEach(c => {
                const caseResults = results.filter(r => r.caseId === c.id);
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

            const untested = cases.length - (pass + fail + block + na);

            const allDefects: { issue: Issue, caseTitle: string }[] = [];
            const caseMap = new Map(cases.map(c => [c.id, c.title]));

            results.forEach(res => {
                if (res.issues && res.issues.length > 0) {
                    res.issues.forEach(issue => {
                        allDefects.push({ issue, caseTitle: caseMap.get(res.caseId) || 'Unknown Case' });
                    });
                }
            });

            setReportData({ run, results, pass, fail, block, na, untested, allDefects });
        });
    }, [selectedRunId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
            <div className="bg-white rounded-lg shadow-xl w-[900px] h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="font-bold text-lg flex items-center gap-2"><BarChart2 size={20} /> 테스트 리포트 생성</h3>
                    <button onClick={onClose}><XCircle size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    {!runId && (
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-2">분석할 실행(Run) 선택</label>
                            <select className="w-full border rounded p-2 text-lg" value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
                                <option value="">-- 테스트 실행 선택 --</option>
                                {runs.map(r => (
                                    <option key={r.id} value={r.id}>{r.title} ({new Date(r.createdAt).toLocaleDateString()})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {reportData ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-4 rounded border border-blue-100 text-center">
                                    <div className="text-sm text-blue-600 font-semibold uppercase">Total Cases</div>
                                    <div className="text-3xl font-bold text-blue-900">{reportData.pass + reportData.fail + reportData.block + reportData.na + reportData.untested}</div>
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
                                                    { name: 'Block', value: reportData.block, fill: '#1f2937' },
                                                    { name: 'NA', value: reportData.na, fill: '#fb923c' },
                                                    { name: 'Untested', value: reportData.untested, fill: '#e5e7eb' }
                                                ]}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="#22c55e" />
                                                <Cell fill="#ef4444" />
                                                <Cell fill="#1f2937" />
                                                <Cell fill="#fb923c" />
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
