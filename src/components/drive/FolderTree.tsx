import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { Folder as FolderType } from '../../types';

interface FolderTreeProps {
    folders: FolderType[];
    activeFolderId: string | null;
    onFolderClick: (folderId: string | null) => void;
    className?: string;
}

// Helper to build tree structure
const buildTree = (folders: FolderType[]) => {
    const map = new Map<string, FolderType & { children: any[] }>();
    const roots: any[] = [];

    // Initialize map
    folders.forEach(f => {
        map.set(f.id, { ...f, children: [] });
    });

    // Build hierarchy
    folders.forEach(f => {
        const node = map.get(f.id)!;
        if (f.parentId && map.has(f.parentId)) {
            map.get(f.parentId)!.children.push(node);
        } else {
            roots.push(node); // Root level or orphan if parent missing
        }
    });

    return roots;
};

const TreeNode = ({ node, activeFolderId, onFolderClick, depth = 0 }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeFolderId === node.id;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleClick = () => {
        onFolderClick(node.id);
        if (!isOpen) setIsOpen(true);
    };

    return (
        <div>
            <div
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer rounded transition-colors ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
            >
                <div onClick={handleToggle} className={`p-0.5 rounded hover:bg-gray-200 ${hasChildren ? 'visible' : 'invisible'}`}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {isOpen || isActive ? <FolderOpen size={16} className={isActive ? 'text-blue-500' : 'text-yellow-500'} /> : <Folder size={16} className={isActive ? 'text-blue-500' : 'text-yellow-500'} />}
                <span className="truncate text-sm">{node.name}</span>
            </div>

            {isOpen && hasChildren && (
                <div>
                    {node.children.map((child: any) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            activeFolderId={activeFolderId}
                            onFolderClick={onFolderClick}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FolderTree = ({ folders, activeFolderId, onFolderClick, className = '' }: FolderTreeProps) => {
    const treeData = buildTree(folders);

    return (
        <div className={`overflow-y-auto ${className}`}>
            <div
                className={`flex items-center gap-2 py-1.5 px-3 cursor-pointer rounded mb-1 ${activeFolderId === null ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                onClick={() => onFolderClick(null)}
            >
                <Folder size={16} className="text-gray-400" />
                <span className="text-sm">My Drive</span>
            </div>

            {treeData.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    activeFolderId={activeFolderId}
                    onFolderClick={onFolderClick}
                />
            ))}
        </div>
    );
};
