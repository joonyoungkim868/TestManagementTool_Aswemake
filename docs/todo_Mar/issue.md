RunnerList 화면에서 모든 진행률이 0%로 나오는 원인은 백엔드(Supabase)에서 데이터를 조회할 때 필요한 컬럼(Column)들을 빼먹고 가져왔기 때문입니다.

지난번에 통계 로직을 '결과(Result)' 행 개수 합산에서 '케이스(Case)' 단위 조회 및 platform_type, device_platform 기반의 조건 판별로 고도화했습니다. 하지만 src/storage.ts의 getRunStats 함수 상단 쿼리문은 과거의 가벼운 조회 방식(select('id, documentId') 등)에 머물러 있어 필요한 데이터가 없어 매칭에 실패하고 전부 UNTESTED로 처리되고 있습니다.

🚨 1. 원인 분석 (src/storage.ts 내부)
TypeScript
// 현재 코드 (src/storage.ts - getRunStats)
const [casesRes, resultsRes] = await Promise.all([
  // ❌ platform_type을 안 가져옴
  supabase.from('testCases').select('id, documentId').in('documentId', targetDocIds),
  // ❌ caseId와 device_platform을 안 가져옴
  supabase.from('testResults').select('runId, status').in('runId', openRunIds)
]);
위 코드 때문에 반복문 내에서 const cRes = runRes.filter(r => r.caseId === c.id); 를 실행해도 r.caseId가 존재하지 않아(undefined) 항상 빈 배열([])이 반환되며, 모든 상태가 UNTESTED로 빠지게 되어 0%가 됩니다.

🛠️ 2. 해결 방법 (코드 수정)
수정 1: src/storage.ts 쿼리 수정
필요한 컬럼(platform_type, caseId, device_platform)을 명시적으로 select에 추가해 줍니다.

TypeScript
// src/storage.ts의 RunService.getRunStats 함수 내부 (Line 384 부근)

const [casesRes, resultsRes] = await Promise.all([
    targetDocIds.length > 0 
        // 💡 [수정] platform_type 추가
        ? supabase.from('testCases').select('id, documentId, platform_type').in('documentId', targetDocIds) 
        : Promise.resolve({ data: [] }),
        
    // 💡 [수정] caseId, device_platform 추가
    supabase.from('testResults').select('runId, caseId, status, device_platform').in('runId', openRunIds)
]);
수정 2: src/components/test-run/RunnerList.tsx의 완료된 Run 통계 버그 수정
추가적으로, RunnerList.tsx 파일 내부에 있는 COMPLETED 상태의 Run 진행률을 구하는 로직(getProgress 함수)도 아직 과거의 단순 배열 길이 합산 방식을 사용하고 있어, 완료된 APP 테스트의 경우 200%로 보일 위험이 있습니다. 이 부분도 '케이스 기준'으로 수정해야 합니다.

TypeScript
// src/components/test-run/RunnerList.tsx 내부 getProgress 함수 교체 (Line 61 부근)

const getProgress = (run: TestRun) => {
    // 1. COMPLETED (스냅샷 기반) 상태인 경우
    if (run.status === 'COMPLETED' && run.snapshot_data) {
        const results = run.snapshot_data.results || [];
        const cases = run.snapshot_data.cases || [];
        const total = cases.length;
        
        let pass = 0, fail = 0, block = 0, na = 0;

        // 💡 여기서도 케이스 단위로 순회하여 이중 카운팅 방지
        cases.forEach((c: any) => {
            const cRes = results.filter((r: any) => r.caseId === c.id);
            let fStatus = 'UNTESTED';

            if (c.platform_type === 'APP') {
                const iStat = cRes.find((r: any) => r.device_platform === 'iOS')?.status || 'UNTESTED';
                const aStat = cRes.find((r: any) => r.device_platform === 'Android')?.status || 'UNTESTED';
                
                if (iStat === 'UNTESTED' || aStat === 'UNTESTED') fStatus = 'UNTESTED';
                else if (iStat === 'FAIL' || aStat === 'FAIL') fStatus = 'FAIL';
                else if (iStat === 'BLOCK' || aStat === 'BLOCK') fStatus = 'BLOCK';
                else if (iStat === 'NA' || aStat === 'NA') fStatus = 'NA';
                else fStatus = 'PASS';
            } else {
                fStatus = cRes.find((r: any) => !r.device_platform || r.device_platform === 'PC')?.status || 'UNTESTED';
            }

            if (fStatus === 'PASS') pass++;
            else if (fStatus === 'FAIL') fail++;
            else if (fStatus === 'BLOCK') block++;
            else if (fStatus === 'NA') na++;
        });

        const executed = pass + fail + block + na;
        const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
        return { percent, label: `${percent}% (${executed}/${total})` };
    } 
    // 2. OPEN (진행 중) 상태인 경우 (저장된 stats 사용)
    else if (runStats[run.id]) {
        const { total, pass, fail, block, na } = runStats[run.id];
        const executed = pass + fail + block + na;
        const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
        return { percent, label: `${percent}% (${executed}/${total})` };
    }
    
    return { percent: 0, label: 'Calculating...' };
};
위 2가지 부분(storage.ts의 select 구문 추가, RunnerList.tsx의 스냅샷 렌더링 로직 교체)을 반영하시면 0% 표기 문제와 200% 표기 문제가 모두 완벽하게 해결됩니다.