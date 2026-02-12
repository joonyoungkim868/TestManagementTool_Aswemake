import React, { useState, useEffect } from 'react';
import { Project, ProjectStatus } from '../../types';

export const ProjectModal = ({
    isOpen, onClose, onSubmit, initialData
}: {
    isOpen: boolean, onClose: () => void, onSubmit: (title: string, desc: string, status: ProjectStatus) => void, initialData?: Project
}) => {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setTitle(initialData.title);
                setDesc(initialData.description);
                setStatus(initialData.status);
            } else {
                setTitle('');
                setDesc('');
                setStatus('ACTIVE');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
                <h3 className="text-lg font-bold mb-4">{initialData ? '프로젝트 수정' : '새 프로젝트 생성'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트 명</label>
                        <input
                            className="w-full border rounded p-2"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="예: TF2000 3월 정기배포"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                        <textarea
                            className="w-full border rounded p-2 h-24"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="프로젝트에 대한 간단한 설명을 입력하세요."
                        />
                    </div>
                    {initialData && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                            <select
                                className="w-full border rounded p-2"
                                value={status}
                                onChange={e => setStatus(e.target.value as ProjectStatus)}
                            >
                                <option value="ACTIVE">진행 중 (Active)</option>
                                <option value="ARCHIVED">보관됨 (Archived)</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded">취소</button>
                    <button
                        onClick={async () => {
                            if (title.trim()) {
                                setLoading(true);
                                await onSubmit(title, desc, status);
                                setLoading(false);
                                onClose();
                            }
                        }}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50 font-bold"
                        disabled={!title.trim() || loading}
                    >
                        {loading ? '처리 중...' : (initialData ? '수정 완료' : '프로젝트 생성')}
                    </button>
                </div>
            </div>
        </div>
    );
};
