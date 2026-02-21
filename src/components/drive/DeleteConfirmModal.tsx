import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    itemName: string;
    itemType: 'FOLDER' | 'DOCUMENT';
}

export const DeleteConfirmModal = ({
    isOpen, onClose, onConfirm, itemName, itemType
}: DeleteConfirmModalProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (confirmText !== itemName) return;

        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border-l-4 border-red-500 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 text-red-600">
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertTriangle size={24} />
                        </div>
                        <h2 className="text-xl font-bold">Delete {itemType}?</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="mb-6 space-y-3">
                    <p className="text-gray-700 font-medium">
                        Are you sure you want to delete <span className="font-bold text-gray-900">"{itemName}"</span>?
                    </p>

                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-700">
                        <strong className="block mb-1">⚠️ Warning: Cascade Delete</strong>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>All <strong>Test Cases</strong> inside will be permanently deleted.</li>
                            <li><strong>Active Runners</strong> referencing these cases will lose them.</li>
                            <li>This action <strong>cannot be undone</strong>.</li>
                        </ul>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm text-gray-600 mb-1">
                            Type <strong>{itemName}</strong> to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder={itemName}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={confirmText !== itemName || isDeleting}
                        className={`px-6 py-2 rounded-lg font-bold text-white transition flex items-center gap-2 ${confirmText === itemName && !isDeleting
                                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'
                                : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                </div>
            </div>
        </div>
    );
};
