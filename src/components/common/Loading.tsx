import React from 'react';
import { Loader2 } from 'lucide-react';

// 1. 공용 스피너 (리스트/상세 화면용)
export const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 animate-in fade-in duration-300">
        <Loader2 size={40} className="animate-spin mb-4 text-primary opacity-50" />
        <p className="text-sm font-medium">데이터를 불러오는 중입니다...</p>
    </div>
);

// 2. 대시보드 전용 스켈레톤 (뼈대 UI)
export const DashboardSkeleton = () => (
    <div className="p-6 space-y-6 animate-pulse">
        <div className="flex justify-between items-center mb-6">
            <div className="h-8 w-64 bg-gray-200 rounded"></div>
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-32 rounded shadow"></div>
            ))}
        </div>
        <div className="bg-gray-200 h-96 rounded shadow mt-6"></div>
    </div>
);
