import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (type: 'FOLDER' | 'DOCUMENT', name: string) => Promise<void>;
    initialType?: 'FOLDER' | 'DOCUMENT';
    initialName?: string;
    mode?: 'CREATE' | 'RENAME';
}

export const DocumentModal = ({
    isOpen, onClose, onSubmit,
    initialType = 'FOLDER',
    initialName = '',
    mode = 'CREATE'
}: DocumentModalProps) => {
    const [type, setType] = useState<'FOLDER' | 'DOCUMENT'>(initialType);
    const [name, setName] = useState(initialName);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setType(initialType);
            setName(initialName);
        }
    }, [isOpen, initialType, initialName]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(type, name);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        {mode === 'CREATE' ? 'Create New' : 'Rename'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'CREATE' && (
                        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                            <button
                                type="button"
                                onClick={() => setType('FOLDER')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'FOLDER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Folder
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('DOCUMENT')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'DOCUMENT' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Document
                            </button>
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {type === 'FOLDER' ? 'Folder Name' : 'Document Title'}
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder={type === 'FOLDER' ? "e.g. Authentication Tests" : "e.g. Login Flow Specification"}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className={`px-6 py-2 rounded-lg font-bold text-white transition ${isSubmitting || !name.trim()
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : type === 'FOLDER' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                        >
                            {isSubmitting ? 'Saving...' : (mode === 'CREATE' ? 'Create' : 'Rename')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
