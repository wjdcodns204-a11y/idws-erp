const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('환경 변수가 설정되지 않았습니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('마이그레이션 스크립트 파트 3 시작...');
    const sql = fs.readFileSync(path.resolve(__dirname, 'supabase_hr_part3.sql'), 'utf-8');

    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
        console.error('RPC 실행 에러:', error.message);
        console.log('\n=======================================');
        console.log('직접 Supabase 대시보드의 [SQL Editor] 메뉴에 접속하여');
        console.log('c:\\IDWS_ERP\\supabase_hr_part3.sql 파일의 내용을 복사하여 실행해주세요.');
        console.log('=======================================\n');
    } else {
        console.log('성공적으로 실행되었습니다.', data);
    }
}

runMigration();
