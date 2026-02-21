import React, { useState, useEffect, useContext } from 'react';
import {
    Plus, Folder, FolderTree, Trash2, ArrowRightLeft, Clock, Edit, List, Loader2, Link as LinkIcon,
    Smartphone, Monitor, AlertTriangle
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, TestCase, HistoryLog } from '@/src/types';
import { TestCaseService, HistoryService, DriveService } from '@/src/storage';
import { AuthContext } from '../../context/AuthContext';
import { formatTextWithNumbers } from '../../utils/formatters';
import { LoadingSpinner } from '../common/Loading';
import { SimpleInputModal } from '../common/SimpleInputModal';
import { HistoryModal } from './HistoryModal';
import { ImportExportModal } from './ImportExportModal';
import { StepRenderer } from '../common/StepRenderer';
import { Breadcrumbs } from '../common/Breadcrumbs';

export const TestCaseManager = () => {
    const { documentId } = useParams();
    const navigate = useNavigate();
    const { user, users } = useContext(AuthContext);

    const [documentTitle, setDocumentTitle] = useState('');
    const [sections, setSections] = useState<Section[]>([]);
    const [cases, setCases] = useState<TestCase[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Modals
    const [isImportOpen, setImportOpen] = useState(false);
    const [isSectionModalOpen, setSectionModalOpen] = useState(false);
    const [isHistoryOpen, setHistoryOpen] = useState(false);

    const [caseHistory, setCaseHistory] = useState<HistoryLog[]>([]);
    const [editForm, setEditForm] = useState<Partial<TestCase>>({});
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const [doc, s, c] = await Promise.all([
                DriveService.getDocument(documentId),
                TestCaseService.getSections(documentId),
                TestCaseService.getCases(documentId)
            ]);
            if (doc) setDocumentTitle(doc.title);
            setSections(s);
            const sortedCases = c.sort((a, b) => (a.seq_id || 0) - (b.seq_id || 0));
            setCases(sortedCases);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (documentId) {
            loadData();
            setSelectedSectionId(null);
            setSelectedCase(null);
            setIsEditing(false);
        }
    }, [documentId]);

    useEffect(() => {
        if (selectedCase && isHistoryOpen) {
            HistoryService.getLogs(selectedCase.id).then(setCaseHistory);
        }
    }, [isHistoryOpen, selectedCase]);

    const filteredCases = selectedSectionId
        ? cases.filter(c => c.sectionId === selectedSectionId)
        : cases;

    const handleCreateCase = () => {
        if (!documentId) return;
        const newCase: Partial<TestCase> = {
            title: '',
            sectionId: selectedSectionId || (sections[0]?.id),
            documentId: documentId, // Replaces projectId
            priority: 'MEDIUM',
            type: 'FUNCTIONAL',
            platform_type: 'WEB',
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
        const isConfirmed = window.confirm(`⚠️ CASCADE WARNING ⚠️\n\nDeleting this test case will PERMANENTLY DELETE it.\nActive Runners utilizing this case may be affected.\n\nAre you sure?`);
        if (!isConfirmed) return;

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

        // Cascade Warning
        if (count > 0) {
            const isConfirmed = window.confirm(`⚠️ CASCADE WARNING ⚠️\n\nDeleting this section will PERMANENTLY DELETE ${count} Test Cases.\nActive Runners utilizing these cases may be affected.\n\nAre you sure?`);
            if (!isConfirmed) return;
        }

        await TestCaseService.deleteSection(sectionId);
        loadData();
        if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
        }
    };

    const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

    if (!documentId) return <div className="p-8 text-center text-gray-500">Document ID missing.</div>;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header with Breadcrumbs */}
            <div className="h-12 border-b flex items-center px-4 bg-gray-50">
                <Breadcrumbs
                    onHomeClick={() => navigate('/drive')}
                    items={[
                        { id: 'doc', name: documentTitle || 'Loading...', onClick: () => { } }
                    ]}
                />
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* 1. Left: Sections */}
                <div className="w-64 bg-gray-50 border-r flex flex-col">
                    <div className="p-3 border-b flex justify-between items-center">
                        <span className="font-bold text-gray-700 text-sm">Sections</span>
                        <button onClick={() => setSectionModalOpen(true)} className="p-1 hover:bg-gray-200 rounded text-blue-600"><Plus size={16} /></button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <div
                                className={`p-2 text-sm rounded cursor-pointer flex items-center gap-2 ${selectedSectionId === null ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}
                                onClick={() => setSelectedSectionId(null)}
                            >
                                <Folder size={16} /> All Cases
                            </div>
                            {sections.map(s => (
                                <div
                                    key={s.id}
                                    className={`p-2 text-sm rounded cursor-pointer flex items-center justify-between group ${selectedSectionId === s.id ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}
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

                {/* 2. Middle: Case List */}
                <div className="w-80 border-r flex flex-col bg-white">
                    <div className="p-3 border-b flex justify-between items-center bg-gray-50/50">
                        <span className="font-bold text-sm text-gray-700">{filteredCases.length} Cases</span>
                        <div className="flex gap-1">
                            <button onClick={() => setImportOpen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Import/Export"><ArrowRightLeft size={16} /></button>
                            <button onClick={handleCreateCase} className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Plus size={18} /></button>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            {filteredCases.map(c => (
                                <div
                                    key={c.id}
                                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 group transition-colors ${selectedCase?.id === c.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                    onClick={() => { setSelectedCase(c); setIsEditing(false); }}
                                >
                                    <div className="text-xs text-gray-500 mb-1 flex justify-between items-start">
                                        <div className="flex gap-2 items-center">
                                            <span className="font-mono text-gray-400">#{c.seq_id || '?'}</span>
                                            <span className={`px-1.5 rounded text-[10px] font-bold ${c.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{c.priority}</span>
                                        </div>
                                        <button onClick={(e) => handleDeleteCase(c.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="font-medium text-sm line-clamp-2 flex items-center gap-1 text-gray-800">
                                        {c.platform_type === 'APP' && <Smartphone size={12} className="text-purple-500 flex-shrink-0" />}
                                        {c.title}
                                    </div>
                                </div>
                            ))}
                            {filteredCases.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No cases found.</div>}
                        </div>
                    )}
                </div>

                {/* 3. Right:/Detail Editor */}
                <div className="flex-1 flex flex-col bg-white">
                    {isEditing ? (
                        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                            <h3 className="text-lg font-bold mb-6 border-b pb-2 flex items-center gap-2"><Edit size={18} /> {editForm.id ? 'Edit Case' : 'New Case'}</h3>
                            <div className="space-y-4 max-w-3xl">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                                    <input className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} autoFocus placeholder="e.g. Verify Login with Valid Credentials" />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Platform Type</label>
                                    <div className="flex gap-4">
                                        <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition ${(!editForm.platform_type || editForm.platform_type === 'WEB') ? 'bg-blue-50 border-blue-200 text-blue-800 ring-1 ring-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="platform_type"
                                                checked={(editForm.platform_type || 'WEB') === 'WEB'}
                                                onChange={() => setEditForm({ ...editForm, platform_type: 'WEB' })}
                                                className="accent-blue-600"
                                            />
                                            <Monitor size={16} />
                                            <span className="text-sm font-medium">WEB</span>
                                        </label>
                                        <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition ${editForm.platform_type === 'APP' ? 'bg-purple-50 border-purple-200 text-purple-800 ring-1 ring-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="platform_type"
                                                checked={editForm.platform_type === 'APP'}
                                                onChange={() => setEditForm({ ...editForm, platform_type: 'APP' })}
                                                className="accent-purple-600"
                                            />
                                            <Smartphone size={16} />
                                            <span className="text-sm font-medium">APP</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Section</label>
                                        <select className="w-full border rounded-lg p-2 bg-white" value={editForm.sectionId || ''} onChange={e => setEditForm({ ...editForm, sectionId: e.target.value })}>
                                            {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Priority</label>
                                        <select className="w-full border rounded-lg p-2 bg-white" value={editForm.priority || 'MEDIUM'} onChange={e => setEditForm({ ...editForm, priority: e.target.value as any })}>
                                            <option value="HIGH">High</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="LOW">Low</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Preconditions</label>
                                    <textarea className="w-full border rounded-lg p-2 h-20 focus:ring-2 focus:ring-blue-500 outline-none" value={editForm.precondition || ''} onChange={e => setEditForm({ ...editForm, precondition: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Note</label>
                                    <textarea
                                        className="w-full border rounded-lg p-2 bg-white h-14 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editForm.note || ''}
                                        onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Test Steps</label>
                                    <div className="space-y-3">
                                        {editForm.steps?.map((step, idx) => (
                                            <div key={idx} className="flex gap-2 items-start group bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <div className="w-6 text-center text-gray-400 py-2 font-bold">{idx + 1}</div>
                                                <textarea
                                                    className="flex-1 border rounded p-2 h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Action"
                                                    value={step.step}
                                                    onChange={e => {
                                                        const newSteps = [...(editForm.steps || [])];
                                                        newSteps[idx].step = e.target.value;
                                                        setEditForm({ ...editForm, steps: newSteps });
                                                    }}
                                                />
                                                <textarea
                                                    className="flex-1 border rounded p-2 h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Expected Result"
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
                                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 font-bold flex items-center justify-center gap-2 transition"
                                        >
                                            <Plus size={16} /> Add Step
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3 justify-end sticky bottom-0 bg-white/90 backdrop-blur pb-4 border-t mt-4">
                                    <button onClick={() => setIsEditing(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                                    <button onClick={handleSaveCase} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm">Save Case</button>
                                </div>
                            </div>
                        </div>
                    ) : selectedCase ? (
                        <div className="flex-1 p-8 overflow-y-auto relative bg-white">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{selectedCase.type}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${selectedCase.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{selectedCase.priority} Priority</span>
                                        {selectedCase.platform_type === 'APP' && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-purple-50 text-purple-600 border-purple-100 flex items-center gap-1">
                                                <Smartphone size={10} /> APP
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedCase.title}</h2>

                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} /> Created: {new Date(selectedCase.createdAt).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Edit size={12} /> Updated:
                                            <button
                                                onClick={() => setHistoryOpen(true)}
                                                className="text-blue-600 font-bold hover:underline flex items-center gap-1 ml-1"
                                            >
                                                {new Date(selectedCase.updatedAt).toLocaleDateString()} (History)
                                            </button>
                                        </div>
                                    </div>

                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeleteCase(selectedCase.id)}
                                        className="px-3 py-1.5 border hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                    <button
                                        onClick={() => { setEditForm(JSON.parse(JSON.stringify(selectedCase))); setIsEditing(true); }}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-2 text-sm font-bold transition"
                                    >
                                        <Edit size={16} /> Edit
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6 max-w-4xl">
                                {selectedCase.precondition && (
                                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-amber-900">
                                        <h4 className="font-bold text-sm text-amber-800 mb-1 flex items-center gap-2"><AlertTriangle size={14} /> Preconditions</h4>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatTextWithNumbers(selectedCase.precondition)}</p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2"><List size={20} /> Test Steps</h4>
                                    <div className="border rounded-lg overflow-hidden shadow-sm">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                                <tr>
                                                    <th className="p-3 w-14 text-center">#</th>
                                                    <th className="p-3 w-1/2 border-r">Action</th>
                                                    <th className="p-3 w-1/2">Expected Result</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {selectedCase.steps.map((s, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                                                        <td className="p-3 border-r whitespace-pre-wrap align-top text-gray-800 leading-relaxed">
                                                            <StepRenderer text={s.step} />
                                                        </td>
                                                        <td className="p-3 whitespace-pre-wrap align-top text-gray-800 leading-relaxed">{formatTextWithNumbers(s.expected)}</td>
                                                    </tr>
                                                ))}
                                                {selectedCase.steps.length === 0 && (
                                                    <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">No steps defined.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {selectedCase.note && (
                                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <h4 className="font-bold text-sm text-gray-600 mb-1 flex items-center gap-2">
                                            <LinkIcon size={14} /> Note
                                        </h4>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{formatTextWithNumbers(selectedCase.note)}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50">
                            <FolderTree size={64} className="mb-4 text-gray-200" />
                            <p className="text-lg font-medium text-gray-400">Select a case to view details</p>
                            <button onClick={handleCreateCase} className="mt-4 px-4 py-2 bg-white border rounded-lg text-sm text-blue-600 font-bold shadow-sm hover:shadow hover:bg-gray-50 transition">
                                + Create New Case
                            </button>
                        </div>
                    )}
                </div>

                <SimpleInputModal
                    isOpen={isSectionModalOpen}
                    onClose={() => setSectionModalOpen(false)}
                    title="New Section"
                    label="Section Name"
                    placeholder="e.g. Auth Flow"
                    onSubmit={async (val) => {
                        if (documentId) {
                            await TestCaseService.createSection({ documentId: documentId, title: val });
                            loadData();
                            setSectionModalOpen(false);
                        }
                    }}
                />

                {documentId && (
                    <ImportExportModal
                        isOpen={isImportOpen}
                        onClose={() => setImportOpen(false)}
                        documentId={documentId}
                        cases={cases}
                        sections={sections}
                        onImportSuccess={loadData}
                    />
                )}

                <HistoryModal isOpen={isHistoryOpen} onClose={() => setHistoryOpen(false)} logs={caseHistory} />
            </div>
        </div>
    );
};