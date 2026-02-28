import { createSupabaseServer } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// 매출 기록 저장/수정 (upsert)
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const body = await req.json();

    const { data, error } = await supabase
        .from('revenue_records')
        .upsert({
            year_month: body.year_month,
            platform: body.platform,
            gross_sales: body.gross_sales || 0,
            returns_amount: body.returns_amount || 0,
            platform_fee_pct: body.platform_fee_pct || 0,
            memo: body.memo || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'year_month,platform' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// 매출 기록 삭제
export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServer();
    const { id } = await req.json();
    const { error } = await supabase.from('revenue_records').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: '삭제 완료' });
}
