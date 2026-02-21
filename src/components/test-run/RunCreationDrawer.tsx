
import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, FolderOpen, FileText, CheckSquare, Square, ChevronRight, ChevronDown, User, Layers } from 'lucide-react';
import { Folder, Document, User as UserType } from '@/src/types';
import { DriveService, RunService, AuthService } from '@/src/storage';

interface RunCreationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export const RunCreationDrawer = ({ isOpen, onClose, onCreated }: RunCreationDrawerProps) => {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [phase, setPhase] = useState('Alpha');
    const [assignees, setAssignees] = useState<string[]>([]);
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

    const [folders, setFolders] = useState<Folder[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);

    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setTitle('');
            setDescription('');
            setPhase('Alpha');
            setAssignees([]);
            setSelectedDocIds(new Set());
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [f, d, u] = await Promise.all([
                DriveService.getAllFolders(),
                DriveService.getAllDocuments(),
                AuthService.getAllUsers()
            ]);
            setFolders(f);
            setDocuments(d);
            setUsers(u);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Build directory tree
    const tree = useMemo(() => {
        const rootFolders = folders.filter(f => !f.parentId);
        const folderMap = new Map<string, Folder & { children: any[], docs: Document[] }>();

        folders.forEach(f => folderMap.set(f.id, { ...f, children: [], docs: [] }));

        folders.forEach(f => {
            if (f.parentId && folderMap.has(f.parentId)) {
                folderMap.get(f.parentId)!.children.push(folderMap.get(f.id));
            }
        });

        documents.forEach(d => {
            if (d.folderId && folderMap.has(d.folderId)) {
                folderMap.get(d.folderId)!.docs.push(d);
            }
            // If no folder or invalid folder, currently ignored or maybe put in root?
            // Assuming documents always have folderId or are root if null (if schema allows)
            // If schema says folderId is required?
        });

        const rootNodes = rootFolders.map(f => folderMap.get(f.id)!);
        // Add root docs if any (folderId null)
        const rootDocs = documents.filter(d => !d.folderId);

        return { roots: rootNodes, rootDocs };
    }, [folders, documents]);

    const toggleDoc = (id: string) => {
        const newSet = new Set(selectedDocIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDocIds(newSet);
    };

    const toggleFolder = (folderNode: any) => {
        // Collect all doc IDs in this folder and subfolders
        const ids: string[] = [];
        const collect = (node: any) => {
            node.docs.forEach((d: Document) => ids.push(d.id));
            node.children.forEach(collect);
        };
        collect(folderNode);

        const allSelected = ids.every(id => selectedDocIds.has(id));
        const newSet = new Set(selectedDocIds);

        if (allSelected) {
            ids.forEach(id => newSet.delete(id));
        } else {
            ids.forEach(id => newSet.add(id));
        }
        setSelectedDocIds(newSet);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return alert("Title is required");
        if (selectedDocIds.size === 0) return alert("Select at least one document");

        setCreating(true);
        try {
            await RunService.create({
                title,
                description,
                phase,
                assignees,
                target_document_ids: Array.from(selectedDocIds)
            });
            onCreated();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to create run");
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-[70] transition-opacity">
            <div className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">New Test Run</h2>
                        <p className="text-sm text-gray-500">Create a new execution cycle</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Step 1: Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={14} /> Run Details
                        </h3>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                            <input
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. v2.4.0 Regression - Core Payment"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                            <textarea
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Optional description..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Phase</label>
                                <div className="relative">
                                    <select
                                        className="w-full border rounded-lg p-2.5 appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={phase}
                                        onChange={e => setPhase(e.target.value)}
                                    >
                                        <option value="Alpha">Alpha</option>
                                        <option value="Beta">Beta</option>
                                        <option value="RC">Release Candidate</option>
                                        <option value="Hotfix">Hotfix</option>
                                        <option value="Gold">Gold</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Assignees</label>
                                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                                    {users.map(u => (
                                        <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                className="rounded text-blue-600 accent-blue-600"
                                                checked={assignees.includes(u.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setAssignees([...assignees, u.id]);
                                                    else setAssignees(assignees.filter(id => id !== u.id));
                                                }}
                                            />
                                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{u.name.charAt(0)}</div>
                                            <span className="truncate">{u.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr />

                    {/* Step 2: Document Selection */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <FolderOpen size={14} /> Select Documents
                            </h3>
                            <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                {selectedDocIds.size} Selected
                            </span>
                        </div>

                        <div className="border rounded-lg h-[300px] overflow-y-auto bg-gray-50 p-2">
                            {loading && <div className="text-center p-4 text-gray-400">Loading directory...</div>}

                            {!loading && (
                                <div className="space-y-1">
                                    {/* Recursive Folder Renderer */}
                                    <FolderNode
                                        nodes={tree.roots}
                                        rootDocs={tree.rootDocs}
                                        selectedDocIds={selectedDocIds}
                                        onToggleDoc={toggleDoc}
                                        onToggleFolder={toggleFolder}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={creating || selectedDocIds.size === 0}
                        className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition"
                    >
                        {creating ? 'Creating...' : 'Create Run'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Recursive Component
const FolderNode = ({ nodes, rootDocs, selectedDocIds, onToggleDoc, onToggleFolder }: any) => {
    return (
        <div className="pl-2">
            {nodes.map((node: any) => (
                <FolderItem
                    key={node.id}
                    node={node}
                    selectedDocIds={selectedDocIds}
                    onToggleDoc={onToggleDoc}
                    onToggleFolder={onToggleFolder}
                />
            ))}
            {rootDocs && rootDocs.map((doc: any) => (
                <DocItem
                    key={doc.id}
                    doc={doc}
                    checked={selectedDocIds.has(doc.id)}
                    onToggle={() => onToggleDoc(doc.id)}
                />
            ))}
        </div>
    );
};

const FolderItem = ({ node, selectedDocIds, onToggleDoc, onToggleFolder }: any) => {
    const [isOpen, setIsOpen] = useState(true);

    // Calc selection state
    const allDocIds: string[] = [];
    const collect = (n: any) => {
        n.docs.forEach((d: any) => allDocIds.push(d.id));
        n.children.forEach(collect);
    };
    collect(node);

    const isAllSelected = allDocIds.length > 0 && allDocIds.every(id => selectedDocIds.has(id));
    const isSomeSelected = allDocIds.some(id => selectedDocIds.has(id));

    return (
        <div className="mb-1">
            <div className="flex items-center gap-1 group">
                <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-gray-200 rounded text-gray-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <div
                    className="flex-1 flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-200 transition"
                    onClick={() => onToggleFolder(node)}
                >
                    {isAllSelected ? <CheckSquare size={16} className="text-blue-600" /> :
                        isSomeSelected ? <div className="w-4 h-4 bg-blue-600 rounded-[3px] flex items-center justify-center"><div className="w-2 h-0.5 bg-white"></div></div> :
                            <Square size={16} className="text-gray-400" />}

                    <FolderOpen size={16} className="text-yellow-500" />
                    <span className="text-sm font-medium text-gray-700">{node.name}</span>
                </div>
            </div>

            {isOpen && (
                <div className="border-l border-gray-200 ml-3 pl-1">
                    <FolderNode
                        nodes={node.children}
                        rootDocs={node.docs}
                        selectedDocIds={selectedDocIds}
                        onToggleDoc={onToggleDoc}
                        onToggleFolder={onToggleFolder}
                    />
                </div>
            )}
        </div>
    );
};

const DocItem = ({ doc, checked, onToggle }: any) => (
    <div
        className="flex items-center gap-2 py-1.5 px-2 ml-6 rounded cursor-pointer hover:bg-blue-50 group transition"
        onClick={onToggle}
    >
        {checked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400 group-hover:text-blue-400" />}
        <FileText size={14} className="text-gray-400" />
        <span className="text-sm text-gray-600">{doc.title}</span>
    </div>
);
