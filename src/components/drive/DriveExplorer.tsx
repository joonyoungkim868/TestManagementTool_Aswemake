import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Folder, FileText, Plus, MoreVertical, Grid, List as ListIcon,
    ChevronRight, Search, Trash2, Edit2, Copy, LayoutDashboard
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { Folder as FolderType, Document } from '../../types';
import { DriveService } from '../../storage';
import { FolderTree } from './FolderTree';
import { Breadcrumbs, BreadcrumbItem } from '../common/Breadcrumbs';
import { DocumentModal } from './DocumentModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { LoadingSpinner } from '../common/Loading';
import { DashboardModal } from '../dashboard/DashboardModal';

export default function DriveExplorer() {
    const { "*": folderIdParam } = useParams();
    const currentFolderId = folderIdParam || null;
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    // Data State
    const [folders, setFolders] = useState<FolderType[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [allFolders, setAllFolders] = useState<FolderType[]>([]); // For Sidebar
    const [loading, setLoading] = useState(true);

    // UI State
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: any, type: 'FOLDER' | 'DOCUMENT' } | null>(null);

    // Modals
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [docModalMode, setDocModalMode] = useState<'CREATE' | 'RENAME'>('CREATE');
    const [docModalType, setDocModalType] = useState<'FOLDER' | 'DOCUMENT'>('FOLDER');
    const [docModalInitialName, setDocModalInitialName] = useState('');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, type: 'FOLDER' | 'DOCUMENT' } | null>(null);

    const [dashboardOpen, setDashboardOpen] = useState(false);
    const [dashboardContext, setDashboardContext] = useState<{ type: 'FOLDER' | 'DOCUMENT' | 'ALL', id: string | null, title: string }>({ type: 'ALL', id: null, title: '' });

    // Click outside context menu to close
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Fetch Data
    const loadData = async () => {
        setLoading(true);
        try {
            const [contents, tree] = await Promise.all([
                DriveService.getFoldersAndDocuments(currentFolderId),
                DriveService.getAllFolders()
            ]);
            setFolders(contents.folders);
            setDocuments(contents.documents);
            setAllFolders(tree);
        } catch (e) {
            console.error("Failed to load drive data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentFolderId]);

    // Helpers for Breadcrumbs
    const getBreadcrumbs = (): BreadcrumbItem[] => {
        const items: BreadcrumbItem[] = [];
        let curr = allFolders.find(f => f.id === currentFolderId);
        while (curr) {
            const f = curr; // Capture for closure
            items.unshift({ id: f.id, name: f.name, onClick: () => navigate(`/drive/${f.id}`) });
            curr = allFolders.find(p => p.id === f.parentId);
        }
        return items;
    };

    // Actions
    const handleCreate = (type: 'FOLDER' | 'DOCUMENT') => {
        setDocModalMode('CREATE');
        setDocModalType(type);
        setDocModalInitialName('');
        setDocModalOpen(true);
    };

    const handleRename = (item: any, type: 'FOLDER' | 'DOCUMENT') => {
        setDocModalMode('RENAME');
        setDocModalType(type);
        setDocModalInitialName(type === 'FOLDER' ? item.name : item.title);
        setItemToDelete({ id: item.id, name: type === 'FOLDER' ? item.name : item.title, type });
        setDocModalOpen(true);
    };

    const [editingItem, setEditingItem] = useState<{ id: string, type: 'FOLDER' | 'DOCUMENT' } | null>(null);

    const onModalSubmit = async (type: 'FOLDER' | 'DOCUMENT', name: string) => {
        if (docModalMode === 'CREATE') {
            if (type === 'FOLDER') {
                await DriveService.createFolder(name, currentFolderId);
            } else {
                if (!currentFolderId) {
                    alert("문서를 생성할 폴더를 먼저 선택해 주세요."); // 한글 안내문구로 변경
                    return;
                }
                await DriveService.createDocument(name, currentFolderId);
            }
        } else {
            if (editingItem?.type === 'FOLDER') {
                await DriveService.renameFolder(editingItem.id, name);
            } else if (editingItem) {
                await DriveService.renameDocument(editingItem.id, name);
            }
        }
        await loadData();
    };

    const handleDuplicate = async (doc: Document) => {
        if (!user) return;
        const newName = `${doc.title} (복사본)`; // 한글화
        if (window.confirm(`"${doc.title}" 문서를 복제하시겠습니까?`)) { // 한글화
            setLoading(true);
            await DriveService.duplicateDocument(doc.id, newName, user);
            await loadData();
        }
    };

    const handleDeleteClick = (item: any, type: 'FOLDER' | 'DOCUMENT') => {
        setItemToDelete({ id: item.id, name: type === 'FOLDER' ? item.name : item.title, type });
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        if (itemToDelete.type === 'FOLDER') {
            await DriveService.deleteFolder(itemToDelete.id);
        } else {
            await DriveService.deleteDocument(itemToDelete.id);
        }
        await loadData();
    };

    const handleContextMenu = (e: React.MouseEvent, item: any, type: 'FOLDER' | 'DOCUMENT') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, type });
        setEditingItem({ id: item.id, type }); 
    };

    const openDashboard = (item: any, type: 'FOLDER' | 'DOCUMENT' | 'ALL' = 'ALL') => {
        if (type === 'ALL') {
            setDashboardContext({ type: 'ALL', id: null, title: '전체 문서' });
        } else {
            setDashboardContext({ type, id: item.id, title: item.name || item.title });
        }
        setDashboardOpen(true);
    };

    return (
        <div className="flex h-full">
            {/* Sidebar Folder Tree */}
            <div className="w-64 border-r bg-gray-50 flex flex-col hidden md:flex">
                <div className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Folders</div>
                <FolderTree
                    folders={allFolders}
                    activeFolderId={currentFolderId}
                    onFolderClick={(id) => navigate(id ? `/drive/${id}` : '/drive')}
                    className="flex-1 px-2"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center flex-1 min-w-0 mr-4">
                        <Breadcrumbs
                            items={getBreadcrumbs()}
                            onHomeClick={() => navigate('/drive')}
                            className="mr-4"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
                            <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-white shadow' : 'text-gray-500'}`}><Grid size={18} /></button>
                            <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-white shadow' : 'text-gray-500'}`}><ListIcon size={18} /></button>
                        </div>

                        <button
                            onClick={() => handleCreate('FOLDER')}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
                        >
                            <Folder size={16} /> New Folder
                        </button>
                        <button
                            onClick={() => handleCreate('DOCUMENT')}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                        >
                            <Plus size={16} /> New Doc
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6" onClick={() => setContextMenu(null)}>
                        {folders.length === 0 && documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Folder size={64} className="mb-4 opacity-20" />
                                <p>폴더가 비어있습니다.</p> {/* 한글화 */}
                            </div>
                        ) : (
                            <div className={viewMode === 'GRID' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4' : 'space-y-2'}>
                                {/* Folders */}
                                {folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        onDoubleClick={() => navigate(`/drive/${folder.id}`)}
                                        onContextMenu={(e) => handleContextMenu(e, folder, 'FOLDER')}
                                        className={`group relative p-4 rounded-xl border hover:border-blue-400 hover:shadow-md transition cursor-pointer bg-blue-50/30 border-blue-100 ${viewMode === 'LIST' ? 'flex items-center gap-4' : 'flex flex-col items-center text-center'}`}
                                    >
                                        <Folder size={viewMode === 'GRID' ? 48 : 24} className="text-blue-400 mb-3 md:mb-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-800 truncate w-full">{folder.name}</div>
                                            {viewMode === 'LIST' && <div className="text-xs text-gray-400">Folder</div>}
                                        </div>
                                        <button
                                            onClick={(e) => handleContextMenu(e, folder, 'FOLDER')}
                                            className="absolute top-2 right-2 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                ))}

                                {/* Documents */}
                                {documents.map(doc => (
                                    <div
                                        key={doc.id}
                                        onDoubleClick={() => navigate(`/drive/doc/${doc.id}`)} // 👈 [이슈 2 해결] 주석 해제 및 라우팅 연결!
                                        onContextMenu={(e) => handleContextMenu(e, doc, 'DOCUMENT')}
                                        className={`group relative p-4 rounded-xl border hover:border-purple-400 hover:shadow-md transition cursor-pointer bg-white ${viewMode === 'LIST' ? 'flex items-center gap-4' : 'flex flex-col items-center text-center'}`}
                                    >
                                        <FileText size={viewMode === 'GRID' ? 48 : 24} className="text-purple-400 mb-3 md:mb-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-800 truncate w-full">{doc.title}</div>
                                            {viewMode === 'LIST' && <div className="text-xs text-gray-400">Document</div>}
                                        </div>
                                        <button
                                            onClick={(e) => handleContextMenu(e, doc, 'DOCUMENT')}
                                            className="absolute top-2 right-2 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border w-48 py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {/* 👇 [이슈 2 관련 추가] 더블클릭을 모르는 사람을 위한 '문서 열기' 버튼 */}
                    {contextMenu.type === 'DOCUMENT' && (
                        <button
                            onClick={() => {
                                navigate(`/drive/doc/${contextMenu.item.id}`);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center gap-2 text-sm text-blue-700 font-bold border-b border-gray-100"
                        >
                            <FileText size={14} /> 문서 열기 (Open)
                        </button>
                    )}

                    {/* 이하 메뉴명 한글화 (이슈 3) */}
                    <button
                        onClick={() => handleRename(contextMenu.item, contextMenu.type)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"
                    >
                        <Edit2 size={14} /> 이름 변경
                    </button>

                    {contextMenu.type === 'DOCUMENT' && (
                        <button
                            onClick={() => handleDuplicate(contextMenu.item)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"
                        >
                            <Copy size={14} /> 복사본 만들기
                        </button>
                    )}

                    <button
                        onClick={() => openDashboard(contextMenu.item, contextMenu.type)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-blue-600 font-medium border-t border-b border-gray-100 my-1 bg-blue-50/50"
                    >
                        <LayoutDashboard size={14} /> 통계 대시보드
                    </button>

                    <button
                        onClick={() => handleDeleteClick(contextMenu.item, contextMenu.type)}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600"
                    >
                        <Trash2 size={14} /> 삭제
                    </button>
                </div>
            )}


            {/* Modals */}
            <DocumentModal
                isOpen={docModalOpen}
                onClose={() => setDocModalOpen(false)}
                onSubmit={onModalSubmit}
                initialType={docModalType}
                initialName={docModalInitialName}
                mode={docModalMode}
            />

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                itemName={itemToDelete?.name || ''}
                itemType={itemToDelete?.type || 'FOLDER'}
            />

            <DashboardModal
                isOpen={dashboardOpen}
                onClose={() => setDashboardOpen(false)}
                contextType={dashboardContext.type}
                contextId={dashboardContext.id}
                title={dashboardContext.title}
            />
        </div>
    );
}