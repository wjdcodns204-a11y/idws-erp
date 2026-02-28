import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { id, status } = await request.json();
        if (!id || !status) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const updateData: Record<string, unknown> = { status };
        if (status === '완료') updateData.resolved_at = new Date().toISOString();

        const { error } = await supabase.from('cs_requests').update(updateData).eq('id', id);
        if (error) return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
