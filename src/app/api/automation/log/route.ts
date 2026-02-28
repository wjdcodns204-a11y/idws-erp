import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// 자동화 실행 결과 기록 API (각 자동화 API에서 호출)
export async function POST(request: Request) {
    try {
        const { job_name, status, error_message } = await request.json();
        if (!job_name || !status) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { error } = await supabase.from('automation_alerts').insert({
            job_name, status, error_message: error_message || null, is_read: false,
        });

        if (error) return NextResponse.json({ error: 'DB 기록 실패' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

// 미읽음 실패 알림 수 조회 (사이드바 뱃지용)
export async function GET() {
    const supabase = createSupabaseAdmin();
    const { count } = await supabase
        .from('automation_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failure')
        .eq('is_read', false);

    return NextResponse.json({ unread_count: count || 0 });
}
