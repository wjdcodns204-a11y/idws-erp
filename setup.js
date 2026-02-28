require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('환경 변수가 없습니다. Supabase 설정을 확인해주세요.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function setupDatabase() {
    try {
        console.log('초기 직원 계정(디비용) 생성 시도 중...');
        // 1. 직원 명부 테이블 생성 시도 전, 바로 직원 Insert 쳐보면 테이블 없어서 에러나는지 먼저 체크
        // SQL 실행을 직접 지원하는 API가 없기 때문에 RPC나 REST를 우회해야 하지만,
        // Supabase JS 클라이언트로는 DDL(CREATE TABLE)을 쏘기 어렵습니다.

        // 대안: 이미 앞서 사용자에게 SQL Editor 실행을 수동으로 안내했던 내용으로 돌아갈 수 없으므로,
        // Supabase REST를 통해 간단히 테이블 목록 요청만 진행합니다.

        console.log('❗️ 자동 DB 셋업 스크립트는 Supabase 권한 상 불가능하여 Auth 유저만 먼저 세팅합니다...');
        const users = [
            { email: 'wjdcodns204@idontwannasell.com', name: '정채운' },
            { email: 'whqhgnss@idontwannasell.com', name: '조보훈' },
            { email: 'vvip8530@idontwannasell.com', name: '방민우' },
            { email: 'dudtla3668@idontwannasell.com', name: '이민종' },
            { email: 'leeju410@idontwannasell.com', name: '이주영' },
            { email: 'hirowav323@idontwannasell.com', name: '최정민' }
        ];

        for (const user of users) {
            const { data, error } = await supabase.auth.admin.createUser({
                email: user.email,
                password: '1234',
                email_confirm: true,
                user_metadata: { name: user.name }
            });
            if (error && !error.message.includes('already')) {
                console.error(`실패: ${user.name} - ${error.message}`);
            } else {
                console.log(`성공: ${user.name} 계정 세팅 완료 (비번: 1234)`);
            }
        }
    } catch (err) {
        console.error('스크립트 오류:', err);
    }
}

setupDatabase();
