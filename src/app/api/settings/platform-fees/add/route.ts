import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// 새 플랫폼 추가
export async function POST(request: Request) {
    try {
        const { platform_name, fee_pct, color } = await request.json();
        const supabase = createSupabaseAdmin();
        const { data: fee, error } = await supabase
            .from('platform_fees')
            .insert({ platform_name, fee_pct, color })
            .select()
            .single();
        if (error) return NextResponse.json({ error: 'DB 오류' }, { status: 500 });
        return NextResponse.json({ success: true, fee });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
