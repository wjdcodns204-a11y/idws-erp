// 누락된 직원(퇴사자 3명)과 휴가 데이터를 DB에 추가하는 스크립트
// 비유: 종이 장부에만 있고 전산에 빠진 데이터를 전산에 입력하는 작업

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

  // ─── 1단계: 누락된 직원 3명 추가 ───
  console.log('=== 1단계: 누락된 직원 추가 ===');

  // 먼저 DB에 있는 직원 이름 목록 가져오기
  const { data: dbEmps } = await supabase.from('employees').select('id, name');
  const dbNameMap = new Map();
  if (dbEmps) dbEmps.forEach(e => dbNameMap.set(e.name, e.id));

  const missingEmps = hrData.employees.filter(e => !dbNameMap.has(e.name));
  console.log(`  누락 직원: ${missingEmps.length}명`);

  for (const emp of missingEmps) {
    const row = {
      name: emp.name,
      email: emp.email,
      role: 'VIEWER',
      department: emp.department,
      position: emp.jobTitle,
      phone: null,
      join_date: emp.hireDate,
      profile_image_url: null,
      status: emp.isActive ? 'active' : 'resigned',
    };

    const { data, error } = await supabase.from('employees').insert(row).select('id, name');
    if (error) {
      console.log(`  ❌ ${emp.name} 추가 실패: ${error.message}`);
    } else {
      console.log(`  ✅ ${emp.name} 추가 완료 (id: ${data[0].id})`);
      dbNameMap.set(data[0].name, data[0].id);
    }
  }

  // ─── 2단계: 누락된 휴가 데이터 추가 ───
  console.log('\n=== 2단계: 누락된 휴가 데이터 확인 ===');

  // DB의 기존 leaves 가져오기 (중복 방지용)
  const { data: dbLeaves, count: dbLeaveCount } = await supabase
    .from('leaves')
    .select('employee_id, leave_type, start_date, end_date', { count: 'exact' });

  console.log(`  DB 기존 휴가: ${dbLeaveCount}건`);
  console.log(`  JSON 전체 휴가: ${hrData.leaveRecords.length}건`);

  // 중복 체크용 Set (employee_id + start_date + leave_type)
  const existingSet = new Set();
  if (dbLeaves) {
    dbLeaves.forEach(l => {
      existingSet.add(`${l.employee_id}_${l.start_date}_${l.leave_type}`);
    });
  }

  // 직원 이름 → DB employee_id 매핑 (최신)
  const { data: allEmps } = await supabase.from('employees').select('id, name');
  const nameToId = new Map();
  if (allEmps) allEmps.forEach(e => nameToId.set(e.name, e.id));

  let insertCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 배치로 처리 (50건씩)
  const batchSize = 50;
  const toInsert = [];

  for (const rec of hrData.leaveRecords) {
    const empId = nameToId.get(rec.employeeName);
    if (!empId) {
      console.log(`  ⚠️ 직원 못 찾음: ${rec.employeeName}`);
      errorCount++;
      continue;
    }

    const key = `${empId}_${rec.startDate}_${rec.leaveType}`;
    if (existingSet.has(key)) {
      skipCount++;
      continue;
    }

    toInsert.push({
      employee_id: empId,
      employee_name: rec.employeeName,
      leave_type: rec.leaveType,
      start_date: rec.startDate,
      end_date: rec.endDate,
      days: rec.days,
      approver: rec.approver,
      note: rec.note,
      status: 'approved',
    });

    existingSet.add(key); // 같은 배치 내 중복 방지
  }

  console.log(`  추가할 휴가: ${toInsert.length}건, 이미 있음: ${skipCount}건`);

  // 배치 INSERT
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('leaves').insert(batch);
    if (error) {
      console.log(`  ❌ 배치 ${Math.floor(i/batchSize)+1} 실패: ${error.message}`);
      errorCount += batch.length;
    } else {
      insertCount += batch.length;
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`  직원: ${missingEmps.length}명 추가`);
  console.log(`  휴가: ${insertCount}건 추가, ${skipCount}건 스킵, ${errorCount}건 에러`);

  // 최종 확인
  const { count: finalEmpCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  const { count: finalLeaveCount } = await supabase.from('leaves').select('*', { count: 'exact', head: true });
  console.log(`\n  최종 직원: ${finalEmpCount}명`);
  console.log(`  최종 휴가: ${finalLeaveCount}건`);
}

main().catch(console.error);
