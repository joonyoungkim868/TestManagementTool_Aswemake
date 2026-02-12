import React from 'react';
import { TestStep } from '@/src/types';

export const StepDiffViewer = ({ oldSteps, newSteps }: { oldSteps: TestStep[], newSteps: TestStep[] }) => {
    const maxLen = Math.max(oldSteps?.length || 0, newSteps?.length || 0);
    const rows = [];

    for (let i = 0; i < maxLen; i++) {
        const o = oldSteps?.[i];
        const n = newSteps?.[i];

        if (!o && n) {
            // Added
            rows.push(
                <div key={i} className="bg-green-50 border-l-4 border-green-400 p-2 mb-2 text-xs">
                    <div className="font-bold text-green-700">Step {i + 1} (Added)</div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <div><span className="font-semibold">Act:</span> {n.step}</div>
                        <div><span className="font-semibold">Exp:</span> {n.expected}</div>
                    </div>
                </div>
            );
        } else if (o && !n) {
            // Removed
            rows.push(
                <div key={i} className="bg-red-50 border-l-4 border-red-400 p-2 mb-2 text-xs opacity-70">
                    <div className="font-bold text-red-700">Step {i + 1} (Removed)</div>
                    <div className="grid grid-cols-2 gap-2 mt-1 line-through text-gray-500">
                        <div>{o.step}</div><div>{o.expected}</div>
                    </div>
                </div>
            );
        } else if (JSON.stringify(o) !== JSON.stringify(n)) {
            // Modified
            rows.push(
                <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2 text-xs">
                    <div className="font-bold text-yellow-700">Step {i + 1} (Modified)</div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="space-y-1">
                            <div className="text-red-500 line-through bg-red-100/50 p-0.5">{o?.step}</div>
                            <div className="text-green-600 bg-green-100/50 p-0.5">{n?.step}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-red-500 line-through bg-red-100/50 p-0.5">{o?.expected}</div>
                            <div className="text-green-600 bg-green-100/50 p-0.5">{n?.expected}</div>
                        </div>
                    </div>
                </div>
            );
        }
    }

    if (rows.length === 0) return <div className="text-gray-400 text-xs italic">No changes in steps</div>;
    return <div>{rows}</div>;
};
