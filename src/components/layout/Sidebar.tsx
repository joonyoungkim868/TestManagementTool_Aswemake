import React, { useContext, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronDown, LayoutGrid, Plus, CheckCircle,
    LayoutDashboard, FolderTree, PlayCircle, Settings, LogOut
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { Project } from '../../types';

interface SidebarProps {
    activeProject: Project | null;
    projects: Project[];
    setProjectModalOpen: (open: boolean) => void;
}

export const Sidebar = ({
    activeProject, projects, setProjectModalOpen
}: SidebarProps) => {
    const { user, logout } = useContext(AuthContext);
    const [isProjectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="w-64 bg-gray-900 text-white flex flex-col shadow-xl flex-shrink-0 h-screen sticky top-0">
            <div className="p-4 border-b border-gray-800">
                <Link to="/projects" className="text-xl font-bold tracking-tight text-blue-400 mb-4 block hover:text-blue-300">QA Manager</Link>

                <div className="relative">
                    <button
                        onClick={() => setProjectDropdownOpen(!isProjectDropdownOpen)}
                        className={`w-full text-left bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition flex justify-between items-center ${isProjectDropdownOpen ? 'ring-1 ring-blue-500' : ''}`}
                    >
                        <div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Active Project</div>
                            <div className="font-bold truncate">{activeProject?.title || 'No Project Selected'}</div>
                        </div>
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isProjectDropdownOpen && (
                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setProjectDropdownOpen(false)}></div>
                    )}

                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 w-full bg-white text-gray-900 rounded shadow-xl mt-1 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-2 py-1.5 border-b mb-1">
                                <Link to="/projects" onClick={() => setProjectDropdownOpen(false)} className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm font-bold flex items-center gap-2 text-gray-700">
                                    <LayoutGrid size={16} /> 전체 프로젝트 보기
                                </Link>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {projects.map(p => (
                                    <Link
                                        key={p.id}
                                        to={`/projects/${p.id}/dashboard`}
                                        onClick={() => setProjectDropdownOpen(false)}
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer font-medium text-sm flex justify-between block text-gray-800"
                                    >
                                        {p.title}
                                        {activeProject?.id === p.id && <CheckCircle size={14} className="text-green-500" />}
                                    </Link>
                                ))}
                            </div>
                            <div className="border-t mt-1 pt-1 px-2 pb-1">
                                <button onClick={() => { setProjectModalOpen(true); setProjectDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-blue-600 text-xs font-bold rounded flex items-center gap-1">
                                    <Plus size={12} /> 새 프로젝트 생성
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {activeProject ? (
                    <>
                        <NavLink
                            to={`/projects/${activeProject.id}/dashboard`}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <LayoutDashboard size={18} /> 대시보드
                        </NavLink>
                        <NavLink
                            to={`/projects/${activeProject.id}/cases`}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <FolderTree size={18} /> 테스트 케이스
                        </NavLink>
                        <NavLink
                            to={`/projects/${activeProject.id}/runs`}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <PlayCircle size={18} /> 테스트 실행
                        </NavLink>
                    </>
                ) : (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        프로젝트를 선택하면 메뉴가 활성화됩니다.
                    </div>
                )}

                {user.role === 'ADMIN' && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <Settings size={18} /> 관리자 설정
                    </NavLink>
                )}
            </nav>

            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-white text-xs">
                        {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-bold text-white truncate">{user.name}</div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                </div>
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2 text-gray-400 hover:text-white text-sm px-2 transition">
                    <LogOut size={16} /> 로그아웃
                </button>
            </div>
        </div>
    );
};
