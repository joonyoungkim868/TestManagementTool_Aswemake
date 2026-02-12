import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { User } from '@/src/types';
import { AuthService } from '@/src/storage';

export const AdminPanel = () => {
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => { AuthService.getAllUsers().then(setUsers); }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Users /> 사용자 관리</h2>
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4">이름</th>
                            <th className="p-4">이메일</th>
                            <th className="p-4">권한</th>
                            <th className="p-4">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="p-4 font-bold">{u.name}</td>
                                <td className="p-4 text-gray-600">{u.email}</td>
                                <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                <td className="p-4"><span className="text-green-600 font-bold text-xs">Active</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
