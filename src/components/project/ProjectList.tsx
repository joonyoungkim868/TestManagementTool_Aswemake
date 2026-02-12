import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Archive, Folder, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Project } from '../../types';
import { useLayout } from '../layout/MainLayout';
import { ProjectService } from '../../storage';

export const ProjectList = () => {
    const { projects, setProjectModalOpen, setEditingProject, refreshProjects } = useLayout();

    const handleEdit = (p: Project) => {
        setEditingProject(p);
        setProjectModalOpen(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("프로젝트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) {
            await ProjectService.delete(id);
            refreshProjects();
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">전체 프로젝트</h1>
                    <p className="text-gray-500 mt-1">관리 중인 모든 품질 보증 프로젝트 목록입니다.</p>
                </div>
                <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="px-4 py-2 bg-primary text-white rounded-lg font-bold shadow hover:bg-blue-600 flex items-center gap-2">
                    <Plus size={20} /> 새 프로젝트
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(p => {
                    const isArchived = p.status === 'ARCHIVED';
                    return (
                        <Link
                            key={p.id}
                            to={`/projects/${p.id}/dashboard`}
                            className={`rounded-xl shadow-sm border p-6 flex flex-col h-52 transition group relative
                  ${isArchived ? 'bg-gray-50 border-gray-200' : 'bg-white hover:border-primary hover:shadow-md cursor-pointer'}
                `}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-2 rounded-lg ${isArchived ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-primary'}`}>
                                    {isArchived ? <Archive size={24} /> : <Folder size={24} />}
                                </div>

                                <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEdit(p); }}
                                        className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded transition"
                                        title="수정 / 상태 변경"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(p.id, e)}
                                        className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded transition"
                                        title="프로젝트 삭제"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                                <h3 className={`font-bold text-xl truncate ${isArchived ? 'text-gray-500' : 'text-gray-900 group-hover:text-primary'}`}>
                                    {p.title}
                                </h3>
                                {isArchived && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">Archived</span>}
                            </div>

                            <p className="text-sm text-gray-500 line-clamp-2 flex-1">{p.description || '설명이 없습니다.'}</p>

                            <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex justify-between items-center">
                                <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                                {!isArchived && <ArrowRight size={16} className="text-gray-300 group-hover:text-primary transition-colors" />}
                            </div>
                        </Link>
                    );
                })}

                <div onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-blue-50 cursor-pointer transition h-52">
                    <Plus size={32} className="mb-2" />
                    <span className="font-bold">새 프로젝트 생성</span>
                </div>
            </div>
        </div>
    )
}
