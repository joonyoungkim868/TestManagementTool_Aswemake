import React, { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutGrid, FolderTree, PlayCircle, Settings, LogOut
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

export const Sidebar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="w-64 bg-gray-900 text-white flex flex-col shadow-xl flex-shrink-0 h-screen sticky top-0">
            <div className="p-4 border-b border-gray-800">
                <Link to="/" className="text-xl font-bold tracking-tight text-blue-400 block hover:text-blue-300">
                    QA Manager
                </Link>
                <div className="text-xs text-gray-500 mt-1">FEB Overhaul v2.0</div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <NavLink
                    to="/drive"
                    className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                    <FolderTree size={18} /> Drive
                </NavLink>

                <NavLink
                    to="/runs"
                    className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                    <PlayCircle size={18} /> Test Runs
                </NavLink>

                {user.role === 'ADMIN' && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <Settings size={18} /> Admin
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
