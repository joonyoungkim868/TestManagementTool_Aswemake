import React, { useState, useEffect, useRef, useContext } from 'react';
import { ArrowRightLeft, FileText, Bug, Download, AlertTriangle, Upload, Smartphone, Monitor } from 'lucide-react';
import { TestCase, Section } from '@/src/types';
import { TestCaseService } from '@/src/storage';
import { AuthContext } from '../../context/AuthContext';
import { parseCSV, exportToCSV, exportToJSON } from '../../utils/csvHelpers';
import { normalizePriority, normalizeType } from '../../utils/formatters';

export const ImportExportModal = ({
    isOpen, onClose, documentId, cases, sections, onImportSuccess
}: {
    isOpen: boolean, onClose: () => void, documentId: string, cases: TestCase[], sections: Section[], onImportSuccess: () => void
}) => {
    const { user } = useContext(AuthContext);
    const [tab, setTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
    const [step, setStep] = useState<'UPLOAD' | 'MAP'>('UPLOAD');

    // Import Mode State (WEB: Single / APP: iOS+Android)
    const [importMode, setImportMode] = useState<'WEB' | 'APP'>('WEB');

    const [csvMatrix, setCsvMatrix] = useState<string[][]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, number>>({});
    const [headerRowIndex, setHeaderRowIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const APP_FIELDS = [
        { key: 'section', label: 'Section/Folder', required: false },
        { key: 'title', label: 'Title', required: true },
        { key: 'priority', label: 'Priority', required: false },
        { key: 'type', label: 'Type', required: false },
        { key: 'precondition', label: 'Precondition', required: false },
        { key: 'note', label: 'Note', required: false },
        { key: 'step', label: 'Step Action', required: false },
        { key: 'expected', label: 'Expected Result', required: false },
    ];

    useEffect(() => {
        if (isOpen) {
            setTab('EXPORT');
            setStep('UPLOAD');
            setCsvMatrix([]);
            setMapping({});
            setHeaderRowIndex(0);
            setImportMode('WEB');
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
                alert("No data found.");
                return;
            }

            let bestIndex = 0;
            let bestScore = -1;
            const SCAN_LIMIT = Math.min(rows.length, 20);
            const KEYWORDS = ['title', 'section', 'folder', 'priority', 'type', 'step', 'expected', 'result', 'note', 'remarks', 'precondition'];

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

            // Auto-detect APP mode
            const isAppCsv = headers.some(h => {
                if (!h) return false;
                const val = String(h).toLowerCase();
                return val.includes('ios') || val.includes('aos') || val.includes('android');
            });
            if (isAppCsv) {
                setImportMode('APP');
            }

            const initialMapping: Record<string, number> = {};
            headers.forEach((h, idx) => {
                if (!h) return;
                const header = h.toLowerCase().trim();
                // Simple heuristic mapping
                if (header.includes('title')) initialMapping['title'] = idx;
                else if (header.includes('section') || header.includes('folder')) initialMapping['section'] = idx;
                else if (header.includes('priority')) initialMapping['priority'] = idx;
                else if (header.includes('type')) initialMapping['type'] = idx;
                else if (header.includes('precondition')) initialMapping['precondition'] = idx;
                else if (header.includes('step') || header.includes('action')) initialMapping['step'] = idx;
                else if (header.includes('expected') || header.includes('result')) initialMapping['expected'] = idx;
                else if (header.includes('note') || header.includes('remark')) initialMapping['note'] = idx;
            });
            setMapping(initialMapping);
            setStep('MAP');
        } catch (e) {
            alert("CSV Parse Error");
        }
    };

    const finalizeImport = async () => {
        if (!user) return;
        if (mapping['title'] === undefined) {
            alert("Title column mapping is required.");
            return;
        }

        const newCases: any[] = [];

        // Group by title
        const groupedData: { title: string, rows: string[][] }[] = [];
        let currentGroup: { title: string, rows: string[][] } | null = null;

        for (let i = headerRowIndex + 1; i < csvMatrix.length; i++) {
            const row = csvMatrix[i];
            if (row.length === 0 || !row.some(c => c && c.trim() !== '')) continue;

            const titleVal = row[mapping['title']] || '';

            if (titleVal && titleVal.trim() !== '') {
                currentGroup = { title: titleVal, rows: [] };
                groupedData.push(currentGroup);
            }

            if (currentGroup) {
                currentGroup.rows.push(row);
            }
        }

        if (groupedData.length === 0) {
            alert("No valid cases found.");
            return;
        }

        for (const group of groupedData) {
            const { title, rows } = group;

            const preconditions = rows.map(r => {
                const val = mapping['precondition'] !== undefined ? r[mapping['precondition']] : '';
                return val ? val.trim() : '';
            });

            const notes = rows.map(r => {
                const val = mapping['note'] !== undefined ? r[mapping['note']] : '';
                return val ? val.trim() : '';
            });

            const isAllPreconditionsSame = preconditions.every(p => p === preconditions[0]);
            const isAllNotesSame = notes.every(n => n === notes[0]);

            const firstRow = rows[0];
            const getVal = (key: string, r: string[] = firstRow) => {
                const idx = mapping[key];
                return (idx !== undefined && r[idx]) ? r[idx] : '';
            };

            const testCase = {
                sectionTitle: getVal('section'),
                title: title,
                priority: normalizePriority(getVal('priority')),
                type: normalizeType(getVal('type')),
                platform_type: importMode,
                precondition: isAllPreconditionsSame ? preconditions[0] : '',
                note: isAllNotesSame ? notes[0] : '',
                steps: [] as any[]
            };

            rows.forEach((r, idx) => {
                let s = getVal('step', r);
                const e = getVal('expected', r);

                if ((!s || !s.trim()) && (!e || !e.trim())) return;

                if (!isAllPreconditionsSame && preconditions[idx]) {
                    s = `[Cond: ${preconditions[idx]}]\n${s}`;
                }

                if (!isAllNotesSame && notes[idx]) {
                    s = `${s}\n\n\n[Note: ${notes[idx]}]`;
                }

                testCase.steps.push({
                    id: Math.random().toString(36).substr(2, 9),
                    step: s || '',
                    expected: e || ''
                });
            });

            if (testCase.steps.length > 0) {
                newCases.push(testCase);
            }
        }

        if (newCases.length === 0) {
            alert("No valid steps found.");
            return;
        }

        setImporting(true);
        // Call with documentId
        await (TestCaseService as any).importCases(documentId, newCases, user);
        setImporting(false);
        onImportSuccess();
        onClose();
        alert(`Successfully imported ${newCases.length} cases.`);
    };

    const getPreviewRow = () => {
        if (csvMatrix.length <= headerRowIndex + 1) return null;
        return csvMatrix[headerRowIndex + 1];
    };

    const previewRow = getPreviewRow();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-[800px] h-[650px] flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2"><ArrowRightLeft size={20} /> Import / Export</h3>
                <div className="flex gap-1 bg-gray-100 p-1 rounded mb-4">
                    <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'EXPORT' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('EXPORT')}>Export</button>
                    <button className={`flex-1 py-1.5 rounded text-sm font-semibold transition ${tab === 'IMPORT' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`} onClick={() => setTab('IMPORT')}>Import</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {tab === 'EXPORT' ? (
                        <div className="space-y-6 p-2">
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileText size={18} /> Export to CSV</h4>
                                <p className="text-sm text-blue-600 mb-4">Compatible with Excel or Google Sheets.</p>
                                <button onClick={() => exportToCSV(cases, sections)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 font-bold text-sm"><Download size={16} /> Download CSV</button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Bug size={18} /> JSON Backup</h4>
                                <p className="text-sm text-gray-600 mb-4">Preserves full data structure.</p>
                                <button onClick={() => exportToJSON(cases)} className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-800 flex items-center gap-2 font-bold text-sm"><Download size={16} /> Download JSON</button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="flex items-center gap-6 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-sm text-gray-700">Platform Type:</span>
                                <label className={`flex items-center gap-2 cursor-pointer ${importMode === 'WEB' ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <input
                                        type="radio"
                                        name="importMode"
                                        checked={importMode === 'WEB'}
                                        onChange={() => setImportMode('WEB')}
                                        className="accent-blue-600"
                                    />
                                    <span className="text-sm flex items-center gap-1"><Monitor size={14} /> WEB</span>
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer ${importMode === 'APP' ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <input
                                        type="radio"
                                        name="importMode"
                                        checked={importMode === 'APP'}
                                        onChange={() => setImportMode('APP')}
                                        className="accent-blue-600"
                                    />
                                    <span className="text-sm flex items-center gap-1"><Smartphone size={14} /> APP</span>
                                </label>
                            </div>

                            {step === 'UPLOAD' ? (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-100">
                                        <div className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={14} /> Note</div>
                                        Uploading a CSV will move to the <strong>Column Mapping</strong> step.
                                    </div>
                                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-blue-400 cursor-pointer transition group">
                                        <Upload size={48} className="mb-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                        <span className="text-lg font-bold text-gray-600 group-hover:text-blue-500">Upload CSV</span>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <textarea
                                            className="flex-1 w-full border rounded p-3 text-sm font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            placeholder={`Section,Title,Priority,Type\n"Auth","Login Test","HIGH","FUNCTIONAL"`}
                                            onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData('text'); processCsvText(text); }}
                                        />
                                        <p className="text-xs text-center text-gray-400 mt-2">Paste CSV content here to analyze directly.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-lg text-gray-800">Map Columns</h4>
                                        <button onClick={() => setStep('UPLOAD')} className="text-sm text-gray-500 hover:underline">Reselect File</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
                                        <div className="overflow-y-auto pr-2 space-y-3">
                                            {APP_FIELDS.map(field => (
                                                <div key={field.key} className="bg-gray-50 p-3 rounded border">
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                                                    <select className="w-full border rounded p-2 text-sm bg-white" value={mapping[field.key] !== undefined ? mapping[field.key] : ''} onChange={(e) => setMapping({ ...mapping, [field.key]: parseInt(e.target.value) })}>
                                                        <option value="">(Ignore)</option>
                                                        {csvHeaders.map((h, idx) => (<option key={idx} value={idx}>{h} (Col {idx + 1})</option>))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-900 rounded p-4 text-gray-300 font-mono text-xs overflow-auto">
                                            <div className="font-bold text-white border-b border-gray-700 pb-2 mb-2">Data Preview</div>
                                            {previewRow ? (
                                                <div className="space-y-2">
                                                    {APP_FIELDS.map(field => {
                                                        const idx = mapping[field.key];
                                                        const val = (idx !== undefined && previewRow[idx]) ? previewRow[idx] : '(empty)';
                                                        return (<div key={field.key} className="flex"><span className="w-32 text-gray-500 text-right mr-3">{field.key}:</span><span className="text-green-400">{val}</span></div>);
                                                    })}
                                                </div>
                                            ) : (<div className="text-gray-500">No data.</div>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Close</button>
                    {tab === 'IMPORT' && step === 'MAP' && (
                        <button disabled={importing} onClick={finalizeImport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center gap-2 disabled:opacity-50">
                            {importing ? 'Importing...' : <><Download size={16} /> Import Now</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};