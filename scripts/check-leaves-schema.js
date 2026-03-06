const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://xfshdibgnhhltnqzdvfp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmc2hkaWJnbmhobHRucXpkdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5MiwiZXhwIjoyMDg2MzIxMDkyfQ.TkRi_OqW7_W7ofGdtcPtKM_S1i0zOO2zags42dZl42U',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // leaves 테이블 샘플 1행 가져오기
  const { data, error } = await supabase.from('leaves').select('*').limit(1);
  if (error) {
    console.log('에러:', error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log('leaves 컬럼:', Object.keys(data[0]).join(', '));
    console.log('샘플:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('leaves 테이블에 데이터 없음');
    // 빈 테이블이면 insert 시도로 컬럼 확인
    const { error: insertErr } = await supabase.from('leaves').insert({ test: 'x' });
    if (insertErr) console.log('insert 에러:', insertErr.message);
  }
}
main();
