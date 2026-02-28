import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { title, stage, assignee, target_date, memo, style_code } = await request.json();
        if (!title) return NextResponse.json({ error: '제목이 필요합니다.' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: card, error } = await supabase
            .from('plm_cards')
            .insert({ title, stage: stage || '기획', assignee: assignee || null, target_date: target_date || null, memo: memo || null, style_code: style_code || null })
            .select()
            .single();

        if (error) return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });

        return NextResponse.json({ success: true, card });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
