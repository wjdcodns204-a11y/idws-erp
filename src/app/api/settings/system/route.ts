import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { settings } = await request.json();
        const supabase = createSupabaseAdmin();

        for (const setting of settings) {
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key: setting.key, value: setting.value, description: setting.description }, { onConflict: 'key' });
            if (error) console.error('설정 저장 오류:', setting.key, error);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
