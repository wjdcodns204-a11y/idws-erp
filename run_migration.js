const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('환경 변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('마이그레이션 스크립트 시작...');
    const sql = fs.readFileSync(path.resolve(__dirname, 'supabase_hr_update.sql'), 'utf-8');

    // Supabase JS 클라이언트는 다중 쿼리 실행(exec)을 명시적으로 지원하지 않는 경우가 많으므로
    // 프로젝트에서 사용 가능한 REST API 또는 rpc 호출을 시도하거나 관리자 대시보드에서 실행 안내 필요.
    // 여기서는 단순히 시도합니다. 만약 실패하면 수동 안내.
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
        console.error('RPC 실행 에러 (execute_sql 함수가 없거나 권한 없음):', error.message);
        console.log('\n=======================================');
        console.log('직접 Supabase 대시보드의 [SQL Editor] 메뉴에 접속하여');
        console.log('c:\\IDWS_ERP\\supabase_hr_update.sql 파일의 내용을 복사하여 실행해주세요.');
        console.log('=======================================\n');
    } else {
        console.log('성공적으로 실행되었습니다.', data);
    }
}

runMigration();
