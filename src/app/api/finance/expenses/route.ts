import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 비용 기록 저장
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data, error } = await supabase
        .from('expense_records')
        .insert({
            year_month: body.year_month,
            category: body.category,
            amount: body.amount,
            description: body.description || null,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 비용 기록 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('expense_records').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '삭제 완료' });
}
