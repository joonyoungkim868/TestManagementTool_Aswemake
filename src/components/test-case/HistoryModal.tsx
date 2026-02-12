import React, { useState, useEffect } from 'react';
import { History, XCircle } from 'lucide-react';
import { HistoryLog } from '../../types';
import { StepDiffViewer } from './StepDiffViewer';

export const HistoryModal = ({ isOpen, onClose, logs }: { isOpen: boolean, onClose: () => void, logs: HistoryLog[] }) => {
    const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);

    useEffect(() => {
        if (isOpen && logs.length > 0) setSelectedLog(logs[0]);
    }, [isOpen, logs]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
            <div className="bg-white rounded-lg shadow-xl w-[900px] h-[70vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="font-bold text-lg flex items-center gap-2"><History size={20} /> 변경 이력 (History Timeline)</h3>
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
