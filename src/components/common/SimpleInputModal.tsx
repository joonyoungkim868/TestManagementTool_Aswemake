import React, { useState, useEffect } from 'react';

export const SimpleInputModal = ({
    isOpen, onClose, title, label, placeholder, onSubmit
}: {
    isOpen: boolean, onClose: () => void, title: string, label: string, placeholder: string, onSubmit: (val: string) => void
}) => {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (isOpen) setValue('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                        autoFocus
                        className="w-full border rounded p-2"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && value.trim()) {
                                onSubmit(value);
                                setValue('');
                            }
                        }}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded">취소</button>
                    <button
                        onClick={() => {
                            if (value.trim()) { onSubmit(value); setValue(''); }
                        }}
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        disabled={!value.trim()}
                    >
                        생성
                    </button>
                </div>
            </div>
        </div>
    );
};
