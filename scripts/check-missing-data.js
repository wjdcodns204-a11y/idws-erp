// 누락 데이터 확인 스크립트
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://xfshdibgnhhltnqzdvfp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmc2hkaWJnbmhobHRucXpkdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5MiwiZXhwIjoyMDg2MzIxMDkyfQ.TkRi_OqW7_W7ofGdtcPtKM_S1i0zOO2zags42dZl42U',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // 1. DB의 employees 목록
  console.log('=== DB employees ===');
  const { data: dbEmps } = await supabase.from('employees').select('id, name, department, status');
  if (dbEmps) {
    dbEmps.forEach(e => console.log(`  ${e.name} (${e.department}) - ${e.status}`));
  }

  // 2. JSON의 employees 목록
  console.log('\n=== JSON hr-data employees ===');
  const hrData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/hr-data.json'), 'utf-8'));
  hrData.employees.forEach(e => console.log(`  ${e.name} (${e.department}) - ${e.status}`));

  // 3. 누락된 직원 찾기
  const dbNames = new Set(dbEmps ? dbEmps.map(e => e.name) : []);
  const missing = hrData.employees.filter(e => !dbNames.has(e.name));
  console.log('\n=== 누락된 직원 ===');
  missing.forEach(e => console.log(`  ${e.name} (${e.department}) - ${e.status}`));

  // 4. DB leaves 건수 vs JSON leaves 건수
  const { count: dbLeaveCount } = await supabase.from('leaves').select('*', { count: 'exact', head: true });
  console.log(`\n=== 휴가 데이터 ===`);
  console.log(`  DB: ${dbLeaveCount}건`);
  console.log(`  JSON: ${hrData.leaves.length}건`);
  console.log(`  누락: ${hrData.leaves.length - dbLeaveCount}건`);

  // 5. DB leaves 샘플
  console.log('\n=== DB leaves 컬럼 ===');
  const { data: leaveSample } = await supabase.from('leaves').select('*').limit(1);
  if (leaveSample && leaveSample[0]) {
    console.log('  컬럼:', Object.keys(leaveSample[0]).join(', '));
    console.log('  샘플:', JSON.stringify(leaveSample[0], null, 2));
  }

  // 6. DB orders 샘플 (컬럼 확인)
  console.log('\n=== DB orders 샘플 ===');
  const { data: orderSample } = await supabase.from('orders').select('*').limit(1);
  if (orderSample && orderSample[0]) {
    console.log('  샘플:', JSON.stringify(orderSample[0], null, 2));
  }
}

main().catch(console.error);
