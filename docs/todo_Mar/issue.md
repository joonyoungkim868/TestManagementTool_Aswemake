1. testrunner -> fail 입력하면 issue 입력칸(제목, 링크 필드) 안보임 - 누락되었는지 확인 필요
2. testrunner -> fail / NA 입력도 모두 진행률에 포함해서 계산해야 함. 현재는 PASS만 진행률로 포함
3. drive -> Testcase document에서 우클릭해서 통계 대시보드 볼 수 있는데, runner에서 볼 수 있어야 되는게 아닐지? 각 테스트에 대한 통계가 필요한거니까
    - 대신, 현재 대시보드에서 조금 더 디벨롭되어야 할 수도 있음 너무 단순 프로그레스 바 느낌이라
---

🚀 TestRunner & Report Improvement Final Plan (Confirmed)
Issue 1: Missing Issue Input Fields when 'FAIL' is Selected in TestRunner
1. Critical Review

Assessment: This is a critical omission that must be fixed immediately.

The core purpose of a QA tool is to discover and track defects. If a test is marked as 'FAIL' but the user cannot input what bug occurred (e.g., Issue ticket title and Jira/GitHub link), the fundamental function of the TestRunner fails.

2. Improvement Approach

Add conditional input fields for 'Defect Label' and 'Defect URL' at the bottom of the BottomResultPane component, which only appear when the Status is set to 'FAIL'.

Design Decision 1 — Single Issue Handling: The current implementation only handles a single item issues[0]. Mapping multiple defects to a single test case is rare, and the UI complexity outweighs the benefits. We will consider expanding to multiple issues later if needed.

Design Decision 2 — TypeScript Safety (Assigning id): The Issue interface requires an id: string. To prevent TypeScript compilation errors and DB identification issues, we will maintain the existing id if it exists, or assign a new unique identifier using Date.now().toString().

3. Code Modification Plan

Target File: src/components/test-run/TestRunner.tsx

Implementation Logic:

TypeScript
{/* Inside BottomResultPane component: Remove existing comments and replace with the following */}
{status === 'FAIL' && (
    <div className="mt-2 space-y-2">
        <label className="block text-xs font-bold text-gray-500">Defect</label>
        <div className="flex gap-2">
            <input
                disabled={disabled}
                className="flex-1 border rounded p-2 text-sm h-9 focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                placeholder="Issue Key (e.g., QA-123)"
                value={defectLabel}
                onChange={e => onUpdate('issues', [{
                    id: data.issues?.[0]?.id || Date.now().toString(), // [Core] Guarantee unique ID
                    label: e.target.value,
                    url: defectUrl
                }])}
                onBlur={onSave} // Maintain the same UX as existing fields
            />
            <input
                disabled={disabled}
                className="flex-1 border rounded p-2 text-sm h-9 focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                placeholder="Issue URL"
                value={defectUrl}
                onChange={e => onUpdate('issues', [{
                    id: data.issues?.[0]?.id || Date.now().toString(), // [Core] Guarantee unique ID
                    label: defectLabel,
                    url: e.target.value
                }])}
                onBlur={onSave}
            />
        </div>
    </div>
)}
4. Impact Scope

Feature: The entire bottom result input panel in TestRunner.

Testing Requirements: Verify that the fields only appear in the FAIL state. Ensure that when focus is lost (onBlur), the data is successfully saved to the DB including the id.

Issue 2: Double Counting and Logic Error in TestRunner Progress Calculation
1. Critical Review

Assessment: Requires a full refactoring of the stats calculation logic, not just a simple formula tweak.

For APP cases, a single case generates two TestResult rows (iOS and Android). If we simply add the array lengths, it exceeds the Total Cases, causing the untested count to become a negative number (critical bug). Since the pie chart, center text, and number cards all rely on this stats object, a fundamental replacement of the logic is mandatory.

2. Improvement Approach

Discard the method of counting rows in runResults. Instead, iterate through runCases to derive a "single aggregated status per case" and count them. This matches the exact logic the CaseSidebar uses to determine status colors.

3. Code Modification Plan

Target File: src/components/test-run/TestRunner.tsx

Implementation Logic:

TypeScript
// 1. Entirely replace the stats useMemo logic
const stats = useMemo(() => {
    const total = runCases.length;
    let pass = 0, fail = 0, block = 0, na = 0;

    runCases.forEach(c => {
        const caseResults = runResults.filter(r => r.caseId === c.id);
        let finalStatus: TestStatus = 'UNTESTED';

        if (c.platform_type === 'APP') {
            const iosRes = caseResults.find(r => r.device_platform === 'iOS');
            const aosRes = caseResults.find(r => r.device_platform === 'Android');

            if      (iosRes?.status === 'FAIL'  || aosRes?.status === 'FAIL')  finalStatus = 'FAIL';
            else if (iosRes?.status === 'BLOCK' || aosRes?.status === 'BLOCK') finalStatus = 'BLOCK';
            else if (iosRes?.status === 'NA'    || aosRes?.status === 'NA')    finalStatus = 'NA';
            else if (iosRes?.status === 'PASS'  && aosRes?.status === 'PASS')  finalStatus = 'PASS';
            else finalStatus = iosRes?.status || aosRes?.status || 'UNTESTED';
        } else {
            const pcRes = caseResults.find(r => !r.device_platform || r.device_platform === 'PC');
            finalStatus = pcRes?.status || 'UNTESTED';
        }

        if      (finalStatus === 'PASS')  pass++;
        else if (finalStatus === 'FAIL')  fail++;
        else if (finalStatus === 'BLOCK') block++;
        else if (finalStatus === 'NA')    na++;
    });

    const untested = total - (pass + fail + block + na);
    return { total, pass, fail, block, na, untested };
}, [runCases, runResults]);

// 2. Center Pie Chart Text — Change to show Progress Rate
<div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-gray-600 text-xs">
    <span>{Math.round(((stats.total - stats.untested) / (stats.total || 1)) * 100) || 0}%</span>
    <span className="text-gray-400 font-normal">Done</span>
</div>
4. Impact Scope

Feature: The entire top dashboard stats panel in TestRunner.

Testing Requirements: Verify that APP cases with conflicting results (e.g., iOS PASS, Android FAIL) are only counted once (as FAIL). Confirm that the Progress (%) correctly increases based on the total case count, not the result count.

Issue 3: Re-linking and Synchronizing ReportModal within the Runner Screen
1. Critical Review

Assessment: We must fully migrate the legacy code (which depended on projectId) to the current data model (Feb Overhaul). Furthermore, the "case-based status aggregation" algorithm derived in Issue 2 must be applied exactly identically to the modal's statistics. Otherwise, a bug will occur where the pie chart totals exceed 100%.

2. Improvement Approach

Remove project from ReportModal.tsx Props and inject an optional runId to branch the UX (whether to skip the dropdown or not).

Maintain data integrity by querying via target_document_ids for OPEN states, and using snapshot_data for COMPLETED states.

[Core] Calculate untested and pass/fail metrics using the exact same case iteration (cases.forEach) logic as established in Issue 2.

3. Code Modification Plan

Target Files: src/components/test-run/ReportModal.tsx, src/components/test-run/TestRunner.tsx

Implementation Logic (ReportModal.tsx data load and stats section):

TypeScript
export const ReportModal = ({ isOpen, onClose, runId }: { isOpen: boolean, onClose: () => void, runId?: string }) => {
    // ... Dropdown branching logic (hide dropdown if runId is present, otherwise fetch all runs)

    useEffect(() => {
        if (!selectedRunId) return;

        RunService.getById(selectedRunId).then(async (run) => {
            if (!run) return;

            let results: TestResult[] = [];
            let cases: TestCase[] = [];

            if (run.status === 'COMPLETED' && run.snapshot_data) {
                results = run.snapshot_data.results || [];
                cases   = run.snapshot_data.cases   || [];
            } else {
                const targetDocIds = run.target_document_ids || [];
                [results, cases] = await Promise.all([
                    RunService.getResults(run.id),
                    targetDocIds.length > 0 ? TestCaseService.getCasesByDocumentIds(targetDocIds) : Promise.resolve([])
                ]);
            }

            // [Core Fix] Apply the exact same case-based aggregation as TestRunner.tsx
            let pass = 0, fail = 0, block = 0, na = 0;
            cases.forEach(c => {
                const caseResults = results.filter(r => r.caseId === c.id);
                let finalStatus: TestStatus = 'UNTESTED';

                if (c.platform_type === 'APP') {
                    const iosRes = caseResults.find(r => r.device_platform === 'iOS');
                    const aosRes = caseResults.find(r => r.device_platform === 'Android');
                    if      (iosRes?.status === 'FAIL'  || aosRes?.status === 'FAIL')  finalStatus = 'FAIL';
                    else if (iosRes?.status === 'BLOCK' || aosRes?.status === 'BLOCK') finalStatus = 'BLOCK';
                    else if (iosRes?.status === 'NA'    || aosRes?.status === 'NA')    finalStatus = 'NA';
                    else if (iosRes?.status === 'PASS'  && aosRes?.status === 'PASS')  finalStatus = 'PASS';
                    else finalStatus = iosRes?.status || aosRes?.status || 'UNTESTED';
                } else {
                    const pcRes = caseResults.find(r => !r.device_platform || r.device_platform === 'PC');
                    finalStatus = pcRes?.status || 'UNTESTED';
                }

                if      (finalStatus === 'PASS')  pass++;
                else if (finalStatus === 'FAIL')  fail++;
                else if (finalStatus === 'BLOCK') block++;
                else if (finalStatus === 'NA')    na++;
            });

            const untested = cases.length - (pass + fail + block + na);

            const caseMap = new Map(cases.map(c => [c.id, c.title]));
            const allDefects: { issue: Issue; caseTitle: string }[] = [];
            results.forEach(res => {
                res.issues?.forEach(issue => {
                    allDefects.push({ issue, caseTitle: caseMap.get(res.caseId) || 'Unknown Case' });
                });
            });

            setReportData({ run, results, pass, fail, block, na, untested, allDefects });
        });
    }, [selectedRunId]);
    // ...
4. Impact Scope

Feature: The entire output of the Report Modal.

Testing Requirements: Verify that clicking "View Report" from the TestRunner header shows a report whose numbers perfectly match the dashboard stats on the current page. Confirm that opening a COMPLETED run accurately displays the snapshot history even if original cases were deleted.