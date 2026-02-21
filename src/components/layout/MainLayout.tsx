import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const MainLayout = () => {
    return (
        <div className="flex h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 overflow-hidden flex flex-col relative h-full">
                <Outlet />
            </div>
        </div>
    );
};
