// src/app/api/hr/setup-users/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

const users = [
    { email: 'wjdcodns204@idontwannasell.com', name: '정채운' },
    { email: 'whqhgnss@idontwannasell.com', name: '조보훈' },
    { email: 'vvip8530@idontwannasell.com', name: '방민우' },
    { email: 'dudtla3668@idontwannasell.com', name: '이민종' },
    { email: 'leeju410@idontwannasell.com', name: '이주영' },
    { email: 'hirowav323@idontwannasell.com', name: '최정민' }
];

export async function GET() {
    try {
        const supabaseAdmin = createSupabaseAdmin();
        const results = [];

        for (const user of users) {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email: user.email,
                password: '1234',
                email_confirm: true,
                user_metadata: { name: user.name }
            });

            if (error) {
                if (error.message.includes('already been registered')) {
                    results.push(`[완료] ${user.name} (${user.email}) - 이미 가입됨`);
                } else {
                    results.push(`[오류] ${user.name} (${user.email}) - ${error.message}`);
                }
            } else {
                results.push(`[성공] ${user.name} (${user.email}) - 생성됨 (pw: 1234)`);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
