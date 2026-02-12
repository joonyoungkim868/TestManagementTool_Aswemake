import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { User } from './types';
import { AuthService } from './storage';

// Components
import { LoginScreen } from './components/auth/LoginScreen';
import { AuthGuard } from './components/auth/AuthGuard';
import { MainLayout } from './components/layout/MainLayout';
import { ProjectList } from './components/project/ProjectList';
import { Dashboard } from './components/dashboard/Dashboard';
import { TestCaseManager } from './components/test-case/TestCaseManager';
import { TestRunner } from './components/test-run/TestRunner';
import { AdminPanel } from './components/admin/AdminPanel';
import { LoadingSpinner } from './components/common/Loading'; // [추가] 로딩 컴포넌트

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    
    // [추가] 앱 초기화 상태 (로그인 체크 중일 때 true)
    const [initializing, setInitializing] = useState(true);

    const login = async (email: string) => {
        const u = await AuthService.login(email);
        if (u) {
            setUser(u);
            localStorage.setItem('tm_current_user_email', u.email);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('tm_current_user_email');
    };

    useEffect(() => {
        const initAuth = async () => {
            // 1. 저장된 이메일로 자동 로그인 시도
            const savedEmail = localStorage.getItem('tm_current_user_email');
            if (savedEmail) {
                try {
                    const u = await AuthService.login(savedEmail);
                    setUser(u);
                } catch (e) {
                    console.error("Auto login failed", e);
                }
            }

            // 2. 전체 사용자 목록 로드 (선택 사항)
            try {
                const allUsers = await AuthService.getAllUsers();
                setUsers(allUsers);
            } catch (e) {
                console.error("Load users failed", e);
            }
            
            // 3. 모든 비동기 작업이 끝나면 초기화 완료 처리
            setInitializing(false);
        };

        initAuth();
    }, []);

    // [추가] 초기화 중일 때는 라우터 대신 로딩 화면을 보여줌 (AuthGuard 튕김 방지)
    if (initializing) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, users }}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginScreen />} />

                    <Route path="/" element={<AuthGuard><MainLayout /></AuthGuard>}>
                        <Route index element={<Navigate to="/projects" replace />} />
                        <Route path="projects" element={<ProjectList />} />
                        <Route path="projects/:projectId/dashboard" element={<Dashboard />} />
                        <Route path="projects/:projectId/cases" element={<TestCaseManager />} />
                        <Route path="projects/:projectId/runs" element={<TestRunner />} />
                        <Route path="admin" element={<AdminPanel />} />
                    </Route>

                    {/* Catch all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    );
};

export default App;