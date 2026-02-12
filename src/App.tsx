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

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);

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
        const savedEmail = localStorage.getItem('tm_current_user_email');
        if (savedEmail) {
            AuthService.login(savedEmail).then(setUser);
        }
        AuthService.getAllUsers().then(setUsers);
    }, []);

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
