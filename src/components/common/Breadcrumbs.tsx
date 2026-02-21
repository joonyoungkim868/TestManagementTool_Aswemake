import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
    id: string;
    name: string;
    onClick?: () => void;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    onHomeClick?: () => void;
    className?: string;
}

export const Breadcrumbs = ({ items, onHomeClick, className = '' }: BreadcrumbsProps) => {
    return (
        <nav className={`flex items-center text-sm text-gray-600 ${className}`} aria-label="Breadcrumb">
            <button
                onClick={onHomeClick}
                className="flex items-center hover:text-blue-600 transition-colors"
            >
                <Home size={16} />
            </button>

            {items.map((item, index) => (
                <div key={item.id} className="flex items-center">
                    <ChevronRight size={14} className="mx-2 text-gray-400" />
                    {index === items.length - 1 ? (
                        <span className="font-semibold text-gray-900 truncate max-w-[200px]">
                            {item.name}
                        </span>
                    ) : (
                        <button
                            onClick={item.onClick}
                            className="hover:text-blue-600 hover:underline transition-colors truncate max-w-[150px]"
                        >
                            {item.name}
                        </button>
                    )}
                </div>
            ))}
        </nav>
    );
};
