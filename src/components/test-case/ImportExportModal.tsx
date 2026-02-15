import React, { useState, useEffect, useRef, useContext } from 'react';
import { ArrowRightLeft, FileText, Bug, Download, AlertTriangle, Upload } from 'lucide-react';
import { TestCase, Section, Project } from '@/src/types';
import { TestCaseService } from '@/src/storage';
import { AuthContext } from '../../context/AuthContext';
import { parseCSV, exportToCSV, exportToJSON } from '../../utils/csvHelpers';
import { normalizePriority, normalizeType } from '../../utils/formatters';

export const ImportExportModal = ({
    isOpen, onClose, project, cases, sections, onImportSuccess
}: {
    isOpen: boolean, onClose: () => void, project: Project, cases: TestCase[], sections: Section[], onImportSuccess: () => void
}) => {
    const { user } = useContext(AuthContext);
    const [tab, setTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
    const [step, setStep] = useState<'UPLOAD' | 'MAP'>('UPLOAD');
    const [csvMatrix, setCsvMatrix] = useState<string[][]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, number>>({});
    const [headerRowIndex, setHeaderRowIndex] = useState(0); // Track detected header row
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const APP_FIELDS = [
        { key: 'section', label: '섹션 (Section/Folder)', required: false },
        { key: 'title', label: '제목 (Title)', required: true },
        { key: 'priority', label: '우선순위 (Priority)', required: false },
        { key: 'type', label: '유형 (Type)', required: false },
        { key: 'precondition', label: '사전조건 (Precondition)', required: false },
        { key: 'note', label: '비고 (Note)', required: false },
        { key: 'step', label: '단계 (Step Action)', required: false },
        { key: 'expected', label: '기대결과 (Expected Result)', required: false },
    ];

    useEffect(() => {
        if (isOpen) {
            setTab('EXPORT');
            setStep('UPLOAD');
            setCsvMatrix([]);
            setMapping({});
            setHeaderRowIndex(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            processCsvText(text);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const processCsvText = (text: string) => {
        try {
            const rows = parseCSV(text);
            if (rows.length < 1) {
                alert("데이터가 없습니다.");
                return;
            }

            let bestIndex = 0;
            let bestScore = -1;
            const SCAN_LIMIT = Math.min(rows.length, 20);
            const KEYWORDS = ['title', '제목', 'section', '섹션', 'folder', '폴더', 'priority', '우선순위', '중요도', 'type', '유형', 'step', '단계', '절차', 'expected', '기대', '결과', 'note', '비고', '노트', 'remarks'];

            for (let i = 0; i < SCAN_LIMIT; i++) {
                const row = rows[i];
                if (!row.some(c => c && c.trim() !== '')) continue;

                let score = 0;
                row.forEach(cell => {
                    if (cell && typeof cell === 'string') {
                        const val = cell.toLowerCase().trim();
                        if (KEYWORDS.some(k => val.includes(k))) score++;
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            if (bestScore <= 0) {
                for (let i = 0; i < SCAN_LIMIT; i++) {
                    if (rows[i].some(c => c && c.trim() !== '')) {
                        bestIndex = i;
                        break;
                    }
                }
            }

            setCsvMatrix(rows);
            setHeaderRowIndex(bestIndex);

            const headers = rows[bestIndex];
            setCsvHeaders(headers);

            const initialMapping: Record<string, number> = {};
            headers.forEach((h, idx) => {
                if (!h) return;
                const header = h.toLowerCase().trim();
                if (header.includes('title') || header.includes('제목')) initialMapping['title'] = idx;
                else if (header.includes('section') || header.includes('folder') || header.includes('섹션')) initialMapping['section'] = idx;
                else if (header.includes('priority') || header.includes('우선순위') || header.includes('중요도')) initialMapping['priority'] = idx;
                else if (header.includes('type') || header.includes('유형')) initialMapping['type'] = idx;
                else if (header.includes('precondition') || header.includes('사전')) initialMapping['precondition'] = idx;
                else if (header.includes('step') || header.includes('action') || header.includes('단계') || header.includes('절차')) initialMapping['step'] = idx;
                else if (header.includes('expected') || header.includes('result') || header.includes('기대') || header.includes('예상')) initialMapping['expected'] = idx;
                else if (header.includes('note') || header.includes('비고') || header.includes('노트') || header.includes('remarks')) initialMapping['note'] = idx;
            });
            setMapping(initialMapping);
            setStep('MAP');
        } catch (e) {
            alert("CSV 파싱 중 오류가 발생했습니다.");
        }
    };

    const finalizeImport = async () => {
        if (!user) return;
        if (mapping['title'] === undefined) {
            alert("제목(Title) 컬럼은 반드시 매핑해야 합니다.");
            return;
        }

        const newCases: any[] = [];
        let currentCase: any = null;

        for (let i = headerRowIndex + 1; i < csvMatrix.length; i++) {
            const row = csvMatrix[i];
            if (row.length === 0) continue;
            const getVal = (key: string) => {
                const idx = mapping[key];
                return (idx !== undefined && row[idx]) ? row[idx] : '';
            };
            const title = getVal('title');

            if (title && title.trim()) {
                currentCase = {
                    sectionTitle: getVal('section'),
                    title: title,
                    priority: normalizePriority(getVal('priority')),
                    type: normalizeType(getVal('type')),
                    precondition: getVal('precondition'),
                    note: getVal('note'),
                    steps: []
                };
                const s = getVal('step');
                const e = getVal('expected');
                if (s || e) {
                    currentCase.steps.push({ id: Math.random().toString(36).substr(2, 9), step: s, expected: e });
                }
                newCases.push(currentCase);
            } else if (currentCase) {
                const s = getVal('step');
                const e = getVal('expected');
                if (s || e) {
                    currentCase.steps.push({ id: Math.random().toString(36).substr(2, 9), step: s, expected: e });
                }
            }
        }

        if (newCases.length === 0) {
            alert("가져올 케이스가 없습니다. 매핑이나 CSV 내용을 확인해주세요.");
            return;
        }
        setImporting(true);
        await (TestCaseService as any).importCases(project.id, newCases, user);
        setImporting(false);
        onImportSuccess();
        onClose();
        alert(`${newCases.length}개의 테스트 케이스를 성공적으로 가져왔습니다.`);
    };

    const getPreviewRow = () => {
        if (csvMatrix.length <= headerRowIndex + 1) return null;

        const titleIdx = mapping['title'];
        if (titleIdx !== undefined) {
            for (let i = headerRowIndex + 1; i < Math.min(csvMatrix.length, headerRowIndex + 6); i++) {
                if (csvMatrix[i][titleIdx] && csvMatrix[i][titleIdx].trim() !== '') {
                    return csvMatrix[i];
                }
            }
        }

        if (csvMatrix.length > headerRowIndex + 1 && csvMatrix[headerRowIndex + 1].some(cell => cell && cell.trim() !== '')) return csvMatrix[headerRowIndex + 1];

        return csvMatrix[headerRowIndex + 1];
    };

    const previewRow = getPreviewRow();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-[800px] h-[650px] flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2"><ArrowRightLeft size={20} /> 데이터 가져오기 / 내보내기</h3>
                <div className="flex gap-1 bg-gray-100 p-1 rounded mb-4">
                    <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'EXPORT' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('EXPORT')}>내보내기 (Export)</button>
                    <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'IMPORT' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('IMPORT')}>가져오기 (Import)</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {tab === 'EXPORT' ? (
                        <div className="space-y-6 p-2">
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileText size={18} /> CSV로 내보내기</h4>
                                <p className="text-sm text-blue-600 mb-4">엑셀이나 구글 스프레드시트에서 편집할 수 있는 CSV 형식입니다.</p>
                                <button onClick={() => exportToCSV(cases, sections)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 font-bold text-sm"><Download size={16} /> CSV 다운로드</button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Bug size={18} /> JSON 백업</h4>
                                <p className="text-sm text-gray-600 mb-4">데이터 전체 구조를 보존할 수 있는 JSON 형식입니다.</p>
                                <button onClick={() => exportToJSON(cases)} className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-800 flex items-center gap-2 font-bold text-sm"><Download size={16} /> JSON 다운로드</button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {step === 'UPLOAD' ? (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-100">
                                        <div className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={14} /> 주의사항</div>
                                        CSV 파일을 업로드하면 <strong>컬럼 매핑 단계</strong>로 이동합니다. 첫 번째 행(Header)을 기준으로 매핑을 시도합니다.
                                    </div>
                                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-primary cursor-pointer transition group">
                                        <Upload size={48} className="mb-4 text-gray-400 group-hover:text-primary transition-colors" />
                                        <span className="text-lg font-bold text-gray-600 group-hover:text-primary">CSV 파일 업로드</span>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <textarea
                                            className="flex-1 w-full border rounded p-3 text-sm font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary outline-none resize-none"
                                            placeholder={`Section,Title,Priority,Type\n"Auth","Login Test","HIGH","FUNCTIONAL"`}
                                            onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData('text'); processCsvText(text); }}
                                        />
                                        <p className="text-xs text-center text-gray-400 mt-2">위 영역에 붙여넣기 하면 자동으로 분석합니다.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-lg text-gray-800">컬럼 매핑 (Map Columns)</h4>
                                        <button onClick={() => setStep('UPLOAD')} className="text-sm text-gray-500 hover:underline">파일 다시 선택</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
                                        <div className="overflow-y-auto pr-2 space-y-3">
                                            {APP_FIELDS.map(field => (
                                                <div key={field.key} className="bg-gray-50 p-3 rounded border">
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                                                    <select className="w-full border rounded p-2 text-sm bg-white" value={mapping[field.key] !== undefined ? mapping[field.key] : ''} onChange={(e) => setMapping({ ...mapping, [field.key]: parseInt(e.target.value) })}>
                                                        <option value="">(무시하기 / 매핑 안함)</option>
                                                        {csvHeaders.map((h, idx) => (<option key={idx} value={idx}>{h} (Col {idx + 1})</option>))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-900 rounded p-4 text-gray-300 font-mono text-xs overflow-auto">
                                            <div className="font-bold text-white border-b border-gray-700 pb-2 mb-2">데이터 미리보기 (데이터가 존재하는 행)</div>
                                            {previewRow ? (
                                                <div className="space-y-2">
                                                    {APP_FIELDS.map(field => {
                                                        const idx = mapping[field.key];
                                                        const val = (idx !== undefined && previewRow[idx]) ? previewRow[idx] : '(empty)';
                                                        return (<div key={field.key} className="flex"><span className="w-32 text-gray-500 text-right mr-3">{field.key}:</span><span className="text-green-400">{val}</span></div>);
                                                    })}
                                                </div>
                                            ) : (<div className="text-gray-500">데이터가 없습니다.</div>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">닫기</button>
                    {tab === 'IMPORT' && step === 'MAP' && (
                        <button disabled={importing} onClick={finalizeImport} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-600 font-bold flex items-center gap-2 disabled:opacity-50">
                            {importing ? '처리 중...' : <><Download size={16} /> 가져오기 완료</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
