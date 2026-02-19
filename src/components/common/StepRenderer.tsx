import React from 'react';
import { formatTextWithNumbers } from '../../utils/formatters';
import { AlertOctagon, FileText } from 'lucide-react';

interface StepRendererProps {
    text: string;
}

export const StepRenderer = ({ text }: StepRendererProps) => {
    if (!text) return null;

    // 1. 파싱 로직: 조건, 비고, 본문을 분리
    // 정규식 설명: 
    // - 조건: 문두(^)에 있는 [조건: 내용] 을 찾음
    // - 비고: 문미($) 혹은 줄바꿈 뒤에 있는 [비고: 내용] 을 찾음
    // - 본문: 나머지
    
    // (단순화를 위해 순차적으로 추출)
    let content = text;
    let precondition = '';
    let note = '';

    // 조건 추출 (맨 앞에 있다고 가정)
    const condMatch = content.match(/^\[조건:\s*(.*?)\](\n|$)/s);
    if (condMatch) {
        precondition = condMatch[1];
        content = content.replace(condMatch[0], '');
    }

    // 비고 추출 (맨 뒤에 있다고 가정, 여러 줄바꿈 허용)
    const noteMatch = content.match(/\n*\[비고:\s*(.*?)\]$/s);
    if (noteMatch) {
        note = noteMatch[1];
        content = content.replace(noteMatch[0], ''); // 본문에서 제거
    }

    // 남은 content가 순수 Action
    content = content.trim();

    return (
        <div className="space-y-2">
            {/* 1. 사전 조건 영역 (스타일 적용) */}
            {precondition && (
                <div className="inline-block bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded font-bold mb-1">
                    <span className="mr-1">[조건]</span>
                    {/* 줄바꿈은 유지하되, 첫 줄은 인라인으로 붙음 */}
                    <span className="whitespace-pre-wrap">{precondition}</span>
                </div>
            )}

            {/* 2. 본문 Action (기존 포맷터 적용) */}
            <div className="whitespace-pre-wrap leading-relaxed">
                {formatTextWithNumbers(content)}
            </div>

            {/* 3. 비고 영역 (3줄 띄우고 하단 표시) */}
            {note && (
                <div className="mt-4 pt-2 border-t border-dashed border-gray-200 text-gray-500 text-xs">
                    <div className="flex items-center gap-1 mb-1 font-bold">
                        <FileText size={10} /> 비고
                    </div>
                    <div className="whitespace-pre-wrap pl-1">
                        {note}
                    </div>
                </div>
            )}
        </div>
    );
};