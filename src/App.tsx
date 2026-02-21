import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { User } from './types';
import { AuthService } from './storage';
import { AdminPanel } from './components/admin/AdminPanel';

// Components
import { LoginScreen } from './components/auth/LoginScreen';
import { AuthGuard } from './components/auth/AuthGuard';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner } from './components/common/Loading';
import { DashboardModal } from './components/dashboard/DashboardModal';

// New Components
import DriveExplorer from './components/drive/DriveExplorer';
import RunnerList from './components/test-run/RunnerList';
import { TestRunner } from './components/test-run/TestRunner';
import { TestCaseManager } from './components/test-case/TestCaseManager';

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);

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
            const savedEmail = localStorage.getItem('tm_current_user_email');
            if (savedEmail) {
                try {
                    const u = await AuthService.login(savedEmail);
                    setUser(u);
                } catch (e) {
                    console.error("Auto login failed", e);
                }
            }

            try {
                const allUsers = await AuthService.getAllUsers();
                setUsers(allUsers);
            } catch (e) {
                console.error("Load users failed", e);
            }

            setInitializing(false);
        };

        initAuth();
    }, []);

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
                        {/* Global Redirect to Drive */}
                        <Route index element={<Navigate to="/drive" replace />} />

                        {/* New Core Routes */}
                        <Route path="drive/doc/:documentId" element={<TestCaseManager />} />
                        <Route path="drive/*" element={<DriveExplorer />} />
                        <Route path="runs" element={<RunnerList />} />
                        <Route path="runs/:runId" element={<TestRunner />} />
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