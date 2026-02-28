import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { id, stage } = await request.json();
        if (!id || !stage) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { error } = await supabase.from('plm_cards').update({ stage }).eq('id', id);

        if (error) return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
