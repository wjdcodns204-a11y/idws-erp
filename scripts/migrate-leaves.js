// 누락된 휴가 데이터를 DB에 추가하는 스크립트
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://xfshdibgnhhltnqzdvfp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmc2hkaWJnbmhobHRucXpkdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5MiwiZXhwIjoyMDg2MzIxMDkyfQ.TkRi_OqW7_W7ofGdtcPtKM_S1i0zOO2zags42dZl42U',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const hrData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/hr-data.json'), 'utf-8'));

  // 직원 이름 → DB id 매핑
  const { data: allEmps } = await supabase.from('employees').select('id, name');
  const nameToId = new Map();
  if (allEmps) allEmps.forEach(e => nameToId.set(e.name, e.id));
  console.log(`직원 ${nameToId.size}명 매핑 완료`);

  // DB 기존 leaves (중복 방지)
  const { data: dbLeaves } = await supabase.from('leaves').select('employee_id, type, start_date');
  const existingSet = new Set();
  if (dbLeaves) {
    dbLeaves.forEach(l => existingSet.add(`${l.employee_id}_${l.start_date}_${l.type}`));
  }
  console.log(`기존 휴가: ${existingSet.size}건`);

  const toInsert = [];
  let skipCount = 0;

  for (const rec of hrData.leaveRecords) {
    const empId = nameToId.get(rec.employeeName);
    if (!empId) {
      console.log(`  ⚠️ 직원 못 찾음: ${rec.employeeName}`);
      continue;
    }

    const key = `${empId}_${rec.startDate}_${rec.leaveType}`;
    if (existingSet.has(key)) {
      skipCount++;
      continue;
    }

    toInsert.push({
      employee_id: empId,
      type: rec.leaveType,
      start_date: rec.startDate,
      end_date: rec.endDate,
      duration_days: rec.days,
      reason: rec.note || '',
      status: '승인',
      approved_by: null,
    });

    existingSet.add(key);
  }

  console.log(`추가할 휴가: ${toInsert.length}건, 스킵: ${skipCount}건`);

  // 배치 INSERT (50건씩)
  let insertCount = 0;
  const batchSize = 50;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('leaves').insert(batch);
    if (error) {
      console.log(`  ❌ 배치 ${Math.floor(i/batchSize)+1} 실패: ${error.message}`);
      // 개별 INSERT 시도
      for (const row of batch) {
        const { error: singleErr } = await supabase.from('leaves').insert(row);
        if (singleErr) {
          console.log(`    ❌ ${row.type} ${row.start_date}: ${singleErr.message}`);
        } else {
          insertCount++;
        }
      }
    } else {
      insertCount += batch.length;
      console.log(`  ✅ 배치 ${Math.floor(i/batchSize)+1}: ${batch.length}건 추가`);
    }
  }

  // 최종 확인
  const { count } = await supabase.from('leaves').select('*', { count: 'exact', head: true });
  console.log(`\n결과: ${insertCount}건 추가, 최종 ${count}건`);
}

main().catch(console.error);
