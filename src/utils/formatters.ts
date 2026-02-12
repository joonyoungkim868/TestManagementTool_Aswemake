export const normalizePriority = (val: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
    const v = val ? val.toUpperCase().trim() : '';
    if (['HIGH', 'H', '상', 'A', '1', 'URGENT'].includes(v)) return 'HIGH';
    if (['LOW', 'L', '하', 'C', '3'].includes(v)) return 'LOW';
    return 'MEDIUM'; // Default to Medium
};

export const normalizeType = (val: string): 'FUNCTIONAL' | 'UI' | 'PERFORMANCE' | 'SECURITY' => {
    const v = val ? val.toUpperCase().trim() : '';
    if (v.includes('UI') || v.includes('유저') || v.includes('화면')) return 'UI';
    if (v.includes('PERF') || v.includes('성능')) return 'PERFORMANCE';
    if (v.includes('SEC') || v.includes('보안')) return 'SECURITY';
    return 'FUNCTIONAL'; // Default
};

export const formatTextWithNumbers = (text: string) => {
    if (!text) return '';
    return text.replace(/([^\n])(\d+\.)/g, '$1\n$2');
};
