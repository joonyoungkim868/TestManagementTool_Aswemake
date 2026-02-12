import React, { useState, useEffect } from 'react';
import { XCircle, FolderTree, CheckSquare, Square } from 'lucide-react';
import { Project, Section, TestCase } from '@/src/types';
import { TestCaseService } from '@/src/storage';

export const RunCreationModal = ({
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
                                                {allSecSelected ? <CheckSquare size={16} className="text-primary" /> :
                                                    someSecSelected ? <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center"><div className="w-2 h-0.5 bg-white"></div></div> :
                                                        <Square size={16} className="text-gray-400" />}
                                            </button>
                                            <FolderTree size={16} className="text-gray-500" />
                                            <span className="font-semibold text-sm">{sec.title}</span>
                                        </div>
                                        <div className="pl-6 space-y-1 mt-1">
                                            {secCases.map(tc => (
                                                <div key={tc.id} className="flex items-center gap-2 text-sm hover:bg-blue-50 px-1 rounded cursor-pointer" onClick={() => toggleCase(tc.id)}>
                                                    {selectedCaseIds.has(tc.id) ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-gray-400" />}
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
                                                    {selectedCaseIds.has(tc.id) ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-gray-400" />}
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
