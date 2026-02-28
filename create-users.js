// create-users.js
// Supabase Auth에 6명의 직원을 생성하고 초기 비밀번호를 '1234'로 세팅하는 일회성 스크립트입니다.
// 실행 방법: 터미널에서 `node create-users.js` 실행 (먼저 .env 파일 로드를 위해 dotenv 설치 필요할 수 있음)

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

// 주의: 이 스크립트는 Service Role Key가 필요합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('환경 변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
    { email: 'wjdcodns204@idontwannasell.com', name: '정채운' },
    { email: 'whqhgnss@idontwannasell.com', name: '조보훈' },
    { email: 'vvip8530@idontwannasell.com', name: '방민우' },
    { email: 'dudtla3668@idontwannasell.com', name: '이민종' },
    { email: 'leeju410@idontwannasell.com', name: '이주영' },
    { email: 'hirowav323@idontwannasell.com', name: '최정민' }
];

async function createAuthUsers() {
    console.log('Supabase Auth 계정 생성을 시작합니다...');

    for (const user of users) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password: '1234',
            email_confirm: true,
            user_metadata: { name: user.name }
        });

        if (error) {
            if (error.message.includes('already been registered')) {
                console.log(`[완료] ${user.name} (${user.email}) - 이미 가입된 계정입니다.`);
            } else {
                console.error(`[오류] ${user.name} (${user.email}) 생성 실패: ${error.message}`);
            }
        } else {
            console.log(`[성공] ${user.name} (${user.email}) 계정 생성 완료! (초기 비밀번호: 1234)`);
        }
    }
    console.log('모든 처리가 완료되었습니다.');
}

createAuthUsers();
