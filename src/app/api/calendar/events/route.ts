import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { title, event_date, platform, color, memo } = await request.json();
        if (!title || !event_date) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: event, error } = await supabase
            .from('launch_calendar_events')
            .insert({ title, event_date, platform: platform || '기타', color: color || '#6366f1', memo: memo || null, is_auto: false })
            .select()
            .single();

        if (error) return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
        return NextResponse.json({ success: true, event });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
