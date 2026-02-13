import React, { useState, useEffect, useContext } from 'react';
import {
    Plus, Folder, FolderTree, Trash2, ArrowRightLeft, Clock, Edit, List, Loader2, Link as LinkIcon
} from 'lucide-react';
import { Section, TestCase, HistoryLog } from '@/src/types';
import { TestCaseService, HistoryService } from '@/src/storage';
import { AuthContext } from '../../context/AuthContext';
import { formatTextWithNumbers } from '../../utils/formatters';
import { LoadingSpinner } from '../common/Loading';
import { SimpleInputModal } from '../common/SimpleInputModal';
import { HistoryModal } from './HistoryModal';
import { ImportExportModal } from './ImportExportModal';
import { useLayout } from '../layout/MainLayout';

export const TestCaseManager = () => {
    const { activeProject, isLoading: isProjectLoading } = useLayout();
    const project = activeProject;

    const { user, users } = useContext(AuthContext);
    const [sections, setSections] = useState<Section[]>([]);
    const [cases, setCases] = useState<TestCase[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isImportOpen, setImportOpen] = useState(false);
    const [isSectionModalOpen, setSectionModalOpen] = useState(false);
    const [isHistoryOpen, setHistoryOpen] = useState(false);
    const [caseHistory, setCaseHistory] = useState<HistoryLog[]>([]);

    const [editForm, setEditForm] = useState<Partial<TestCase>>({});

    const [loading, setLoading] = useState(true);

    const loadData = () => {
        if (!project) return;
        setLoading(true);
        Promise.all([
            TestCaseService.getSections(project.id),
            TestCaseService.getCases(project.id)
        ]).then(([s, c]) => {
            setSections(s);

            const sortedCases = c.sort((a, b) => {
                const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
            });
            
            setCases(sortedCases);
            setLoading(false);
        });
    };

    useEffect(() => {
        if (project) {
            loadData();
            setSelectedSectionId(null);
            setSelectedCase(null);
            setIsEditing(false);
        }
    }, [project]);

    useEffect(() => {
        if (selectedCase && isHistoryOpen) {
            HistoryService.getLogs(selectedCase.id).then(setCaseHistory);
        }
    }, [isHistoryOpen, selectedCase]);

    const filteredCases = selectedSectionId
        ? cases.filter(c => c.sectionId === selectedSectionId)
        : cases;

    const handleCreateCase = () => {
        if (!project) return;
        const newCase: Partial<TestCase> = {
            title: '',
            sectionId: selectedSectionId || (sections[0]?.id),
            projectId: project.id,
            priority: 'MEDIUM',
            type: 'FUNCTIONAL',
            steps: [{ id: '1', step: '', expected: '' }]
        };
        setEditForm(newCase);
        setSelectedCase(null);
        setIsEditing(true);
    };

    const handleSaveCase = async () => {
        if (!editForm.title || !user) return;
        const saved = await TestCaseService.saveCase(editForm, user);
        setIsEditing(false);
        loadData();
        setSelectedCase(saved);
    };

    const handleDeleteCase = async (caseId: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        await TestCaseService.deleteCase(caseId);
        loadData();
        if (selectedCase?.id === caseId) {
            setSelectedCase(null);
            setIsEditing(false);
        }
    };

    const handleDeleteSection = async (sectionId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();

        const sectionCases = cases.filter(c => c.sectionId === sectionId);
        const count = sectionCases.length;

        if (count > 0) {
            const isConfirmed = window.confirm(`해당 폴더 삭제 시, 하위 ${count}개의 테스트케이스가 삭제됩니다. 삭제하시겠습니까?`);
            if (!isConfirmed) return;
        }

        await TestCaseService.deleteSection(sectionId);
        loadData();
        if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
        }
    };

    const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

    if (isProjectLoading) return <LoadingSpinner />;
    if (!project) return <div className="p-8 text-center text-gray-500">프로젝트를 찾을 수 없습니다.</div>;

    return (
        <div className="flex h-full bg-white rounded shadow overflow-hidden">
            {/* 1. 왼쪽 섹션 패널 */}
            <div className="w-64 bg-gray-50 border-r flex flex-col">
                <div className="p-3 border-b flex justify-between items-center">
                    <span className="font-bold text-gray-700 text-sm">섹션 (Folders)</span>
                    <button onClick={() => setSectionModalOpen(true)} className="p-1 hover:bg-gray-200 rounded"><Plus size={16} /></button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <div
                            className={`p-2 text-sm rounded cursor-pointer flex items-center gap-2 ${selectedSectionId === null ? 'bg-blue-100 text-primary font-bold' : 'hover:bg-gray-100'}`}
                            onClick={() => setSelectedSectionId(null)}
                        >
                            <Folder size={16} /> 모든 케이스
                        </div>
                        {sections.map(s => (
                            <div
                                key={s.id}
                                className={`p-2 text-sm rounded cursor-pointer flex items-center justify-between group ${selectedSectionId === s.id ? 'bg-blue-100 text-primary font-bold' : 'hover:bg-gray-100'}`}
                                onClick={() => setSelectedSectionId(s.id)}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FolderTree size={16} className="flex-shrink-0" /> <span className="truncate">{s.title}</span>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteSection(s.id, e)}
                                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. 중간 케이스 리스트 패널 */}
            <div className="w-80 border-r flex flex-col">
                <div className="p-3 border-b flex justify-between items-center bg-white">
                    <span className="font-bold text-sm text-gray-700">{filteredCases.length} 케이스</span>
                    <div className="flex gap-1">
                        <button onClick={() => setImportOpen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="가져오기/내보내기"><ArrowRightLeft size={16} /></button>
                        <button onClick={handleCreateCase} className="p-1 hover:bg-blue-50 text-primary rounded"><Plus size={18} /></button>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        {filteredCases.map(c => (
                            <div
                                key={c.id}
                                className={`p-3 border-b cursor-pointer hover:bg-gray-50 group ${selectedCase?.id === c.id ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
                                onClick={() => { setSelectedCase(c); setIsEditing(false); }}
                            >
                                <div className="text-xs text-gray-500 mb-1 flex justify-between items-start">
                                    <div className="flex gap-2 items-center">
                                        <span>{c.id.substr(0, 4)}</span>
                                        <span className={`px-1 rounded text-[10px] ${c.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{c.priority}</span>
                                    </div>
                                    <button onClick={(e) => handleDeleteCase(c.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <div className="font-medium text-sm line-clamp-2">{c.title}</div>
                            </div>
                        ))}
                        {filteredCases.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">케이스가 없습니다.</div>}
                    </div>
                )}
            </div>

            {/* 3. 오른쪽 상세 패널 */}
            <div className="flex-1 flex flex-col bg-white">
                {isEditing ? (
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <h3 className="text-lg font-bold mb-6 border-b pb-2">케이스 작성 / 수정</h3>
                        <div className="space-y-4 max-w-3xl">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">제목</label>
                                <input className="w-full border rounded p-2" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} autoFocus />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">섹션</label>
                                    <select className="w-full border rounded p-2" value={editForm.sectionId || ''} onChange={e => setEditForm({ ...editForm, sectionId: e.target.value })}>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">우선순위</label>
                                    <select className="w-full border rounded p-2" value={editForm.priority || 'MEDIUM'} onChange={e => setEditForm({ ...editForm, priority: e.target.value as any })}>
                                        <option value="HIGH">높음 (High)</option>
                                        <option value="MEDIUM">중간 (Medium)</option>
                                        <option value="LOW">낮음 (Low)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">사전 조건</label>
                                <textarea className="w-full border rounded p-2 h-20" value={editForm.precondition || ''} onChange={e => setEditForm({ ...editForm, precondition: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">테스트 단계</label>
                                <div className="space-y-2">
                                    {editForm.steps?.map((step, idx) => (
                                        <div key={idx} className="flex gap-2 items-start group">
                                            <div className="w-8 text-center text-gray-400 py-2">{idx + 1}</div>
                                            <textarea
                                                className="flex-1 border rounded p-2 h-16 resize-none"
                                                placeholder="행동 (Action)"
                                                value={step.step}
                                                onChange={e => {
                                                    const newSteps = [...(editForm.steps || [])];
                                                    newSteps[idx].step = e.target.value;
                                                    setEditForm({ ...editForm, steps: newSteps });
                                                }}
                                            />
                                            <textarea
                                                className="flex-1 border rounded p-2 h-16 resize-none"
                                                placeholder="기대결과 (Expected)"
                                                value={step.expected}
                                                onChange={e => {
                                                    const newSteps = [...(editForm.steps || [])];
                                                    newSteps[idx].expected = e.target.value;
                                                    setEditForm({ ...editForm, steps: newSteps });
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newSteps = editForm.steps?.filter((_, i) => i !== idx);
                                                    setEditForm({ ...editForm, steps: newSteps });
                                                }}
                                                className="text-gray-400 hover:text-red-500 p-2"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setEditForm({ ...editForm, steps: [...(editForm.steps || []), { id: Date.now().toString(), step: '', expected: '' }] })}
                                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-primary hover:text-primary font-bold flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} /> 단계 추가
                                    </button>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded hover:bg-gray-50">취소</button>
                                <button onClick={handleSaveCase} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 font-bold">저장</button>
                            </div>
                        </div>
                    </div>
                ) : selectedCase ? (
                    <div className="flex-1 p-8 overflow-y-auto relative">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{selectedCase.type}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${selectedCase.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{selectedCase.priority} Priority</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedCase.title}</h2>

                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} /> Created by {getUserName(selectedCase.authorId)} on {new Date(selectedCase.createdAt).toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Edit size={12} /> Updated by
                                        <button
                                            onClick={() => setHistoryOpen(true)}
                                            className="text-blue-600 font-bold hover:underline flex items-center gap-1 ml-1"
                                        >
                                            (History) {new Date(selectedCase.updatedAt).toLocaleString()}
                                        </button>
                                    </div>
                                </div>

                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDeleteCase(selectedCase.id)}
                                    className="px-3 py-1.5 border rounded hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm font-semibold"
                                >
                                    <Trash2 size={16} /> 삭제
                                </button>
                                <button
                                    onClick={() => { setEditForm(JSON.parse(JSON.stringify(selectedCase))); setIsEditing(true); }}
                                    className="px-3 py-1.5 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm font-semibold"
                                >
                                    <Edit size={16} /> 수정
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {selectedCase.precondition && (
                                <div className="bg-yellow-50 p-4 rounded border border-yellow-100">
                                    <h4 className="font-bold text-sm text-yellow-800 mb-1">사전 조건</h4>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{formatTextWithNumbers(selectedCase.precondition)}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2"><List size={20} /> 테스트 절차</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                            <tr>
                                                <th className="p-3 w-12 text-center">#</th>
                                                <th className="p-3 w-1/2 border-r">행동 (Action)</th>
                                                <th className="p-3 w-1/2">기대 결과 (Expected)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedCase.steps.map((s, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                                    <td className="p-3 border-r whitespace-pre-wrap">{formatTextWithNumbers(s.step)}</td>
                                                    <td className="p-3 whitespace-pre-wrap">{formatTextWithNumbers(s.expected)}</td>
                                                </tr>
                                            ))}
                                            {selectedCase.steps.length === 0 && (
                                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">등록된 단계가 없습니다.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <FolderTree size={48} className="mb-4 text-gray-200" />
                        <p className="text-lg font-medium">테스트 케이스를 선택하거나 생성하세요</p>
                    </div>
                )}
            </div>

            <SimpleInputModal
                isOpen={isSectionModalOpen}
                onClose={() => setSectionModalOpen(false)}
                title="새 섹션 생성"
                label="섹션 이름"
                placeholder="예: 로그인, 결제 모듈"
                onSubmit={async (val) => { if (project) { await TestCaseService.createSection({ projectId: project.id, title: val }); loadData(); setSectionModalOpen(false); } }}
            />
            <ImportExportModal
                isOpen={isImportOpen}
                onClose={() => setImportOpen(false)}
                project={project}
                cases={cases}
                sections={sections}
                onImportSuccess={loadData}
            />
            <HistoryModal isOpen={isHistoryOpen} onClose={() => setHistoryOpen(false)} logs={caseHistory} />
        </div>
    );
};
